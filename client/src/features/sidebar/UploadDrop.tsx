import { useState } from 'react';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconBan, IconUpload } from '@tabler/icons-react';
import { useUpload } from '../../api/useUpload';

/** The file types Atlas reads, by MIME type and extension, so a file with an unknown type still matches by name. */
const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
};

const plural = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

/** A one-line drop zone under the folder path. Dropped or chosen files are uploaded and indexed. */
export function UploadDrop() {
  const upload = useUpload();
  const [rejected, setRejected] = useState<string[]>([]);

  const uploading = upload.isPending ? (upload.variables?.length ?? 0) : null;
  const message =
    rejected.length > 0
      ? `Not added: ${rejected.join(', ')}. Atlas reads PDF and Excel files (.pdf, .xlsx, .xlsm).`
      : (upload.error?.message ?? null);

  return (
    <Stack gap={6}>
      <Dropzone
        onDropAny={() => setRejected([])}
        onDrop={(files) => {
          if (files.length > 0) upload.mutate(files);
        }}
        onReject={(rejections) => setRejected(rejections.map((rejection) => rejection.file.name))}
        accept={ACCEPT}
        disabled={uploading !== null}
        px="sm"
        py={8}
        aria-label="Drop PDF or Excel files here, or press Enter to choose them"
      >
        <Dropzone.Idle>
          <Group gap="xs" justify="center" wrap="nowrap" c={uploading === null ? undefined : 'dimmed'}>
            {uploading === null ? <IconUpload size={16} stroke={1.5} /> : <Loader size={14} />}
            <Text fz="sm" c="inherit">
              {uploading === null ? 'Drop PDF or Excel files' : `Uploading ${plural(uploading)}`}
            </Text>
          </Group>
        </Dropzone.Idle>
        <Dropzone.Accept>
          <Group gap="xs" justify="center" wrap="nowrap">
            <IconUpload size={16} stroke={1.5} />
            <Text fz="sm" c="inherit">
              Drop to add them
            </Text>
          </Group>
        </Dropzone.Accept>
        <Dropzone.Reject>
          <Group gap="xs" justify="center" wrap="nowrap">
            <IconBan size={16} stroke={1.5} />
            <Text fz="sm" c="inherit">
              Only PDF and Excel files
            </Text>
          </Group>
        </Dropzone.Reject>
      </Dropzone>
      {message !== null && (
        <Text role="alert" fz="xs" lh="sm" c="var(--mantine-color-error)">
          {message}
        </Text>
      )}
    </Stack>
  );
}
