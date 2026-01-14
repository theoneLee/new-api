/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Tag, Button, Space, Dropdown } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import { renderQuota, timestamp2string, isAdmin } from '../../../helpers';
import {
    SUBSCRIPTION_STATUS,
    SUBSCRIPTION_ACTIONS,
} from '../../../constants/subscription.constants';

/**
 * Render subscription status
 */
const renderStatus = (status, t) => {
    switch (status) {
        case SUBSCRIPTION_STATUS.ENABLED:
            return (
                <Tag color='green' shape='circle'>
                    {t('已启用')}
                </Tag>
            );
        case SUBSCRIPTION_STATUS.DISABLED:
            return (
                <Tag color='orange' shape='circle'>
                    {t('已禁用')}
                </Tag>
            );
        default:
            return (
                <Tag color='black' shape='circle'>
                    {t('未知状态')}
                </Tag>
            );
    }
};

/**
 * Get subscription table column definitions
 */
export const getSubscriptionsColumns = ({
    t,
    manageSubscription,
    setEditingSubscription,
    setShowEdit,
    showDeleteModal,
}) => {
    const columns = [
        {
            title: t('ID'),
            dataIndex: 'id',
        },
        {
            title: t('名称'),
            dataIndex: 'name',
        },
        {
            title: t('状态'),
            dataIndex: 'status',
            render: (text) => renderStatus(text, t),
        },
        {
            title: t('每日额度'),
            dataIndex: 'daily_quota',
            render: (text) => renderQuota(parseInt(text)),
        },
        {
            title: t('剩余额度'),
            dataIndex: 'remain_quota',
            render: (text) => renderQuota(parseInt(text)),
        },
        {
            title: t('刷新时间'),
            dataIndex: 'refresh_time',
        },
        {
            title: t('过期时间'),
            dataIndex: 'expired_time',
            render: (text) => timestamp2string(text),
        },
    ];

    if (isAdmin()) {
        columns.splice(1, 0, {
            title: t('用户ID'),
            dataIndex: 'user_id',
        });
    }

    columns.push({
        title: '',
        dataIndex: 'operate',
        fixed: 'right',
        width: 150,
        render: (text, record) => {
            return (
                <Space>
                    <Button
                        type='tertiary'
                        size='small'
                        onClick={() => {
                            setEditingSubscription(record);
                            setShowEdit(true);
                        }}
                        disabled={!isAdmin()}
                    >
                        {t('编辑')}
                    </Button>
                    <Dropdown
                        trigger='click'
                        position='bottomRight'
                        render={
                            <Dropdown.Menu>
                                <Dropdown.Item
                                    onClick={() => showDeleteModal(record)}
                                    type='danger'
                                >
                                    {t('删除')}
                                </Dropdown.Item>
                                {record.status === SUBSCRIPTION_STATUS.ENABLED ? (
                                    <Dropdown.Item
                                        onClick={() => manageSubscription(record.id, SUBSCRIPTION_ACTIONS.DISABLE, record)}
                                        type='warning'
                                    >
                                        {t('禁用')}
                                    </Dropdown.Item>
                                ) : (
                                    <Dropdown.Item
                                        onClick={() => manageSubscription(record.id, SUBSCRIPTION_ACTIONS.ENABLE, record)}
                                        type='secondary'
                                    >
                                        {t('启用')}
                                    </Dropdown.Item>
                                )}
                            </Dropdown.Menu>
                        }
                    >
                        <Button type='tertiary' size='small' icon={<IconMore />} />
                    </Dropdown>
                </Space>
            );
        },
    });

    return columns;
};
