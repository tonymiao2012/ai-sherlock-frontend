import { Button, Dropdown, Space } from 'antd';
import { DownOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { CaseV2, CaseStatus } from '../types';
import { getNextStatuses, CASE_STATUS_META } from '../domain/caseLifecycle';
import { useSession } from '../context/Session';

interface CaseActionsProps {
  caseItem: CaseV2;
  onAssign: (caseId: string, assigneeId: string) => Promise<void>;
  onStatusChange: (caseId: string, newStatus: CaseStatus) => Promise<void>;
}

export function CaseActions({ caseItem, onAssign, onStatusChange }: CaseActionsProps) {
  const { can, users, groupsV2 } = useSession();

  const group = groupsV2.find((g) => g.id === caseItem.groupId);
  const groupMembers = users.filter((u) => group?.memberIds.includes(u.id));

  const canAssign = can('case.assign', { case: caseItem });
  const canChangeStatus = can('case.status.modify', { case: caseItem });

  const nextStatuses = getNextStatuses(caseItem.status);

  const assignMenu = {
    items: groupMembers.map((u) => ({
      key: u.id,
      label: `${u.name} (${u.email})`,
    })),
    onClick: ({ key }: { key: string }) => onAssign(caseItem.id, key),
  };

  const statusMenu = {
    items: nextStatuses.map((s) => ({
      key: s,
      label: CASE_STATUS_META[s]?.label ?? s,
    })),
    onClick: ({ key }: { key: string }) => onStatusChange(caseItem.id, key as CaseStatus),
  };

  return (
    <Space size={4}>
      {canAssign && (
        <Dropdown menu={assignMenu} trigger={['click']}>
          <Button size="small" type="link" icon={<UserSwitchOutlined />}>
            分配
          </Button>
        </Dropdown>
      )}
      {canChangeStatus && nextStatuses.length > 0 && (
        <Dropdown menu={statusMenu} trigger={['click']}>
          <Button size="small" type="link">
            状态 <DownOutlined />
          </Button>
        </Dropdown>
      )}
    </Space>
  );
}
