import { useState } from 'react';
import { Tabs } from '@mantine/core';
import type { DocumentSummary } from '@atlas/shared';
import { SheetView } from './SheetView';
import classes from './WorkbookView.module.css';

const tabsClasses = { root: classes.root, panel: classes.panel, list: classes.list, tab: classes.tab };

/** A whole workbook, one sheet at a time from its top, with the sheet tabs along the foot as in Excel. */
export function WorkbookView({ document }: { document: DocumentSummary }) {
  const [chosen, setChosen] = useState(document.sheets[0] ?? '');
  // A reloaded workbook can lose the chosen sheet; the first one stands in for it.
  const sheet = document.sheets.includes(chosen) ? chosen : (document.sheets[0] ?? '');

  return (
    <Tabs
      value={sheet}
      onChange={(value) => {
        if (value !== null) setChosen(value);
      }}
      inverted
      keepMounted={false}
      classNames={tabsClasses}
    >
      {document.sheets.map((name) => (
        <Tabs.Panel key={name} value={name}>
          <SheetView document={document} sheet={name} cited={null} />
        </Tabs.Panel>
      ))}
      <Tabs.List aria-label="Sheets">
        {document.sheets.map((name) => (
          <Tabs.Tab key={name} value={name}>
            <bdi>{name}</bdi>
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
