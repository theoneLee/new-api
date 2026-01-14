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
import { Typography, Switch, Space } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const SubscriptionsDescription = ({ compactMode, setCompactMode, t }) => {
    return (
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full mb-4'>
            <div>
                <Title heading={3} className='mb-1'>
                    {t('订阅管理')}
                </Title>
                <Text type='secondary'>
                    {t('管理您的会员订阅，享受每日刷新的专属额度')}
                </Text>
            </div>
            <Space align='center' className='bg-gray-50 p-2 rounded-lg'>
                <Text size='small' type='secondary'>
                    {t('紧凑模式')}
                </Text>
                <Switch
                    size='small'
                    checked={compactMode}
                    onChange={(checked) => setCompactMode(checked)}
                />
            </Space>
        </div>
    );
};

export default SubscriptionsDescription;
