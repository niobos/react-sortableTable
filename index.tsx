import * as React from "react";
import {CSSProperties, ReactElement, useState} from "react";

import './index.css';
import innerText from "react-innertext";

export type DataColumnConfig<TItem = object> = {
    value: (item: TItem) => string | ReactElement,
    cmp?: (a: TItem, b: TItem) => number,
    classList?: string | string[] | ((item: TItem) => string[]),
    style?: CSSProperties | ((item: TItem) => CSSProperties),
}

export type ColumnConfig<TItem = object> = {
    title: string | ReactElement,
} & (
    {
        children: ColumnConfig<TItem>[],
    }
    | DataColumnConfig<TItem>
    )

export interface SortableTableProps<TItem = object> {
    columns: ColumnConfig<TItem>[],
    data: TItem[],
    initialSortColumnNr?: number | null,
    initialSortDir?: 1 | -1,
}

function dataColumns<TItem>(columnConfig: ColumnConfig<TItem>[]): DataColumnConfig<TItem>[] {
    const columns: DataColumnConfig<TItem>[] = [];
    for (let column of columnConfig) {
        if ("value" in column) {
            if (!('cmp' in column)) {
                const valueF = column.value;
                column.cmp = (a, b) => {
                    let aVal = valueF(a);
                    if (React.isValidElement(aVal)) {
                        aVal = innerText(aVal);
                    }
                    let bVal = valueF(b);
                    if (React.isValidElement(bVal)) {
                        bVal = innerText(bVal);
                    }
                    if (aVal === bVal) return 0;
                    if (aVal < bVal) return -1;
                    if (aVal > bVal) return 1;
                    console.error("Can't compare:", a, b);
                    return 0;
                }
            }

            if (!('classList' in column)) column.classList = [];
            if (typeof column.classList === 'string') column.classList = [column.classList];

            if (!('style' in column)) column.style = {};

            columns.push(column)
        } else if("children" in column) {
            columns.push(...dataColumns(column.children))
        } else {
            throw TypeError("Unexpected type")
        }
    }
    return columns
}

function nestingLevel<TItem>(columnConfig: ColumnConfig<TItem>[]): number {
    let level = 1
    for (let column of columnConfig) {
        if("children" in column) {
            level = Math.max(level, 1 + nestingLevel(column.children))
        }
    }
    return level
}

function headers<TItem>(
    columnConfig: ColumnConfig<TItem>[],
    sortColumnNr: number, setSortColumnNr,
    sortDir: -1 | 1, setSortDir,
    nestLevel: number,
    colOffset: number = 0
): {nodes: React.ReactNode[][], cols: number} {
    const columnHeaders = Array.from(Array(nestLevel), () => []);
    let cols = colOffset
    for (let column of columnConfig) {
        if("children" in column) {
            const {nodes: childHeaders, cols: childCols} = headers(
                column.children,
                sortColumnNr, setSortColumnNr, sortDir, setSortDir,
                nestLevel - 1,
                cols,
            )
            for(let rowIdx = 0; rowIdx < childHeaders.length; rowIdx++) {
                for(let col of childHeaders[rowIdx]) {
                    columnHeaders[1+rowIdx].push(col)
                }
            }
            columnHeaders[0].push(<th key={cols} colSpan={childCols}>{column.title}</th>)
            cols += childCols

        } else if("value" in column) {
            const sortStyle = sortColumnNr === cols ? (sortDir > 0 ? "sort asc" : "sort desc") : ""
            const colsClosure = cols
            columnHeaders[0].push(
                <th key={cols}
                    rowSpan={nestLevel}
                    onClick={() => {
                        if(sortColumnNr === colsClosure) {
                            setSortDir(-sortDir as 1 | -1);
                        } else {
                            setSortColumnNr(colsClosure);
                            setSortDir(1);
                        }
                    }}
                    className={sortStyle}
                >{column.title}
                </th>
            )
            cols++

        } else {
            throw TypeError("invalid type")
        }
    }
    return {nodes: columnHeaders, cols: cols - colOffset}
}

export default function SortableTable<TItem = object>(props: SortableTableProps<TItem>) {
    /* Displays items in a sortable table.
     * `data` is an array of objects, one for each row to display
     * `columns` is an array of columns to extract from each item to display:
     *   it's an object containing:
     *     - title: Text to put in the column header
     *     - value: f(item): value to put in this column
     *     - cmp(a, b): compare function to compare entire objects for sorting this column
     *                  default: a[key] <=> b[key]
     *     - classList: string, string[] or f(item): string[]
     *     - style: object or f(item): object
     */
    const [sortColumnNr, setSortColumnNr] = useState(props.initialSortColumnNr ?? null);
    const [sortDir, setSortDir] = useState(props.initialSortDir ?? 1);

    const columns = dataColumns(props.columns || [])

    const maxNesting = nestingLevel(props.columns || [])
    const {nodes: columnHeaders} = headers(
        props.columns || [],
        sortColumnNr, setSortColumnNr, sortDir, setSortDir,
        maxNesting,
    )

    const rows = [];
    const dataSortedIndices = [...Array((props.data || []).length).keys()].sort((a, b) => {
        if(sortColumnNr === null) {
            return (a - b);
        }
        return columns[sortColumnNr].cmp(props.data[a], props.data[b]) * sortDir;
    });
    for(let i of dataSortedIndices) {
        const item = props.data[i];
        const td = [];
        for(let j = 0; j < columns.length; j++) {
            const column = columns[j];
            let classList = column.classList;
            if(typeof classList === 'function') classList = classList(item);

            let style = column.style;
            if(typeof style === 'function') style = style(item);

            td.push(<td key={j} className={(classList as string[]).join(' ')}
                        style={style}>{column.value(item)}</td>
            );
        }
        rows.push(<tr key={i}>{td}</tr>);
    }

    return <table className="sortableTable">
        <thead>
        {columnHeaders.map<React.ReactNode>(v => <tr>{v}</tr>)
            .reduce((prev, cur) => [prev, cur])}
        </thead>
        <tbody>{rows}</tbody>
    </table>;
}
