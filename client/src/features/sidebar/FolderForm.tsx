import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Anchor, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useLoadFolder } from '../../api/useLoadFolder';
import { folderErrorMessage } from './folderErrorMessage';
import { SAMPLE_FOLDER, cleanFolderPath } from './folderPath';

const emptyPathHint = 'Type the path of a folder first, for example C:\\Projects\\Riyadh Tower.';

/**
 * The folder path box and its Load button. Enter loads too; a problem shows in a line under the box.
 * Out of focus the box shows the end of a long path, where the folder's own name is, and hovering
 * it shows the whole path.
 */
export function FolderForm() {
  const status = useFolderStatus();
  const load = useLoadFolder();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  // What the user typed; null shows the folder the server has loaded.
  const [draft, setDraft] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const value = draft ?? status.data?.folder ?? '';
  const message = hint ?? (load.error ? folderErrorMessage(load.error, load.variables ?? '') : null);

  // After a load and on blur, scroll the text to its end so the folder name is what shows. Hiding
  // the sidebar or resizing the window resets that scroll, so it is set again whenever the box resizes.
  useEffect(() => {
    const input = inputRef.current;
    if (!input || focused) return;
    const showEnd = () => {
      input.scrollLeft = input.scrollWidth;
    };
    showEnd();
    const observer = new ResizeObserver(showEnd);
    observer.observe(input);
    return () => observer.disconnect();
  }, [value, focused]);

  const change = (next: string) => {
    setDraft(next);
    setHint(null);
    if (load.isError) load.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (load.isPending) return;
    const path = cleanFolderPath(value);
    if (path === '') {
      setHint(emptyPathHint);
      inputRef.current?.focus();
      return;
    }
    setHint(null);
    load.mutate(path, { onSuccess: () => setDraft(null) });
  };

  const fillSample = () => {
    change(SAMPLE_FOLDER);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={6}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text component="label" htmlFor={inputId} fz="sm" fw={600}>
            Project folder
          </Text>
          <Anchor component="button" type="button" fz="xs" onClick={fillSample}>
            Use sample project
          </Anchor>
        </Group>
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Tooltip label={value} disabled={value === '' || focused} position="bottom-start">
            <TextInput
              id={inputId}
              ref={inputRef}
              flex={1}
              miw={0}
              value={value}
              onChange={(event) => change(event.currentTarget.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="C:\Projects\Riyadh Tower"
              error={message !== null}
              aria-describedby={message === null ? undefined : errorId}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
          </Tooltip>
          <Button type="submit" loading={load.isPending}>
            Load
          </Button>
        </Group>
        {message !== null && (
          <Text id={errorId} role="alert" fz="xs" lh="sm" c="var(--mantine-color-error)">
            {message}
          </Text>
        )}
      </Stack>
    </form>
  );
}
