import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DataTable from './DataTable';

const rows = Array.from({ length: 30 }, (_, i) => ({ id: `row-${String(i).padStart(2, '0')}`, n: i }));
const columns = [{ key: 'id', label: 'ID' }, { key: 'n', label: 'Number' }];

function table(props) {
    return (
        <DataTable label="Rows" rowLabel="row" controlsLabel="Row controls" rows={rows} columns={columns}
            getId={(row) => row.id} defaultSort={{ key: 'n', order: 'asc' }} rowsPerPage={25} {...props} />
    );
}

function ids() {
    // An open column filter hides the rest of the page from assistive technology
    return within(screen.getByRole('table', { name: 'Rows', hidden: true })).getAllByRole('row', { hidden: true }).slice(1)
        .map((row) => row.querySelector('td').textContent);
}

test('rows are shown a page at a time', () => {
    render(table());
    expect(ids()).toHaveLength(25);
    expect(ids()[0]).toBe('row-00');
    userEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(ids()).toEqual(['row-25', 'row-26', 'row-27', 'row-28', 'row-29']);
    // Filtering starts over on the first page
    userEvent.click(screen.getByRole('button', { name: 'Filter ID' }));
    userEvent.type(screen.getByRole('textbox', { name: 'Filter ID' }), 'row-0');
    expect(ids()).toHaveLength(10);
});

test('a row selected from elsewhere is shown on its page', () => {
    const { rerender } = render(table());
    expect(ids()).not.toContain('row-28');
    rerender(table({ selectedId: 'row-28' }));
    expect(ids()).toContain('row-28');
});

test('the column chooser is not modal, so the table shows the change', () => {
    render(table());
    userEvent.click(screen.getByRole('button', { name: 'Show columns' }));
    userEvent.click(screen.getByRole('checkbox', { name: 'Number' }));
    expect(screen.queryByRole('columnheader', { name: 'Number' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Number' })).toBeInTheDocument();
    userEvent.keyboard('{Escape}');
});

test('clicking anywhere on a header sorts, but its filter button does not', () => {
    render(table({ rows: rows.slice(0, 3) }));
    const header = screen.getByRole('columnheader', { name: 'Number' });
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    userEvent.click(header);
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(ids()).toEqual(['row-02', 'row-01', 'row-00']);
    userEvent.click(within(header).getByRole('button', { name: 'Filter Number' }));
    userEvent.keyboard('{Escape}');
    expect(screen.getByRole('columnheader', { name: 'Number', hidden: true })).toHaveAttribute('aria-sort', 'descending');
});

test('cells stay on one line, and flexible columns share the width and truncate', () => {
    const text = 'a-name-that-is-much-too-long-for-its-column';
    render(table({
        rows: [{ id: 'row-00', n: 0, name: text, owner: 'someone' }],
        columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name', flex: 3 },
            { key: 'owner', label: 'Owner', flex: 1, render: (row) => <b>{row.owner}</b> },
        ],
        defaultSort: { key: 'id', order: 'asc' },
    }));
    const cell = (field) => screen.getByRole('table', { name: 'Rows' }).querySelector(`td[data-field="${field}"]`);
    // Fixed columns are as wide as their contents
    expect(cell('id')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(cell('id')).not.toHaveStyle({ maxWidth: '0' });
    expect(screen.getByRole('columnheader', { name: 'ID' }).style.width).toBe('');
    // Flexible columns divide the rest by their weights, and cut off what doesn't fit
    expect(cell('name')).toHaveStyle({ maxWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    expect(cell('name')).toHaveAttribute('title', text);
    expect(screen.getByRole('columnheader', { name: 'Name' }).style.width).toBe('75%');
    expect(screen.getByRole('columnheader', { name: 'Owner' }).style.width).toBe('25%');
    // Rendered cells name their own contents
    expect(cell('owner')).not.toHaveAttribute('title');
});
