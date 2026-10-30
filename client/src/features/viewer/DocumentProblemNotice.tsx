import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconDownload, IconFileOff } from '@tabler/icons-react';
import type { DocumentSummary } from '@atlas/shared';
import { api } from '../../api/endpoints';
import { useCopy } from '../../i18n/useCopy';
import { noticeStyles } from '../errors/noticeStyles';
import { statusLook } from '../sidebar/fileStatus';
import { sidebarCopy } from '../sidebar/sidebarCopy';
import { ViewerNotice } from './ViewerNotice';
import { viewerCopy } from './viewerCopy';

interface DocumentProblemNoticeProps {
  document: DocumentSummary;
  /** Why the viewer cannot show it, from documentProblem. */
  reason: string;
}

/** In place of a file the viewer cannot draw: why, in the file status's colour, and the file itself to download. */
export function DocumentProblemNotice({ document, reason }: DocumentProblemNoticeProps) {
  const copy = useCopy(viewerCopy);
  const look = statusLook(document.status, useCopy(sidebarCopy));
  const Icon = look?.icon ?? IconFileOff;

  return (
    <ViewerNotice>
      <Alert
        title={copy.cannotShow}
        icon={<Icon size={18} stroke={1.75} />}
        styles={noticeStyles(look?.color ?? 'gray')}
      >
        <Stack gap="xs" align="flex-start">
          <Text fz="sm" c="gray.8">
            {reason}
          </Text>
          <Button
            component="a"
            href={api.documentFileUrl(document.id)}
            download={document.name}
            variant="default"
            size="xs"
            leftSection={<IconDownload size={14} stroke={1.75} />}
          >
            {copy.download}
          </Button>
        </Stack>
      </Alert>
    </ViewerNotice>
  );
}
