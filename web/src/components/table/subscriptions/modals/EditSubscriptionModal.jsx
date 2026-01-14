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

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    API,
    showError,
    showSuccess,
    renderQuota,
    renderQuotaWithPrompt,
    isAdmin,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
    Button,
    SideSheet,
    Space,
    Spin,
    Typography,
    Card,
    Tag,
    Form,
    Avatar,
    Row,
    Col,
} from '@douyinfe/semi-ui';
import {
    IconSave,
    IconClose,
    IconGift,
    IconCreditCard,
    IconUser,
    IconSetting,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const EditSubscriptionModal = (props) => {
    const { t } = useTranslation();
    const isEdit = props.editingSubscription.id !== undefined;
    const [loading, setLoading] = useState(false);
    const isMobile = useIsMobile();
    const formApiRef = useRef(null);

    const getInitValues = () => ({
        user_id: undefined,
        name: '',
        daily_quota: 1000000,
        models: '',
        channels: '',
        groups: '',
        refresh_time: '00:00',
        expired_time: null,
        allow_user_balance: true,
    });

    const handleCancel = () => {
        props.handleClose();
    };

    const loadSubscription = async () => {
        if (!props.editingSubscription.id) return;
        setLoading(true);
        try {
            let res = await API.get(`/api/subscription/${props.editingSubscription.id}`);
            const { success, message, data } = res.data;
            if (success) {
                if (data.expired_time === 0 || data.expired_time === undefined) {
                    data.expired_time = null;
                } else {
                    data.expired_time = new Date(data.expired_time * 1000);
                }
                formApiRef.current?.setValues(data);
            } else {
                showError(message);
            }
        } catch (e) {
            showError(e.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (formApiRef.current) {
            if (isEdit) {
                loadSubscription();
            } else {
                formApiRef.current.setValues(getInitValues());
            }
        }
    }, [props.editingSubscription.id, props.visiable]);

    const submit = async (values) => {
        setLoading(true);
        let localInputs = { ...values };
        localInputs.user_id = parseInt(localInputs.user_id);
        localInputs.daily_quota = parseInt(localInputs.daily_quota);

        if (!localInputs.expired_time) {
            localInputs.expired_time = 0;
        } else {
            localInputs.expired_time = Math.floor(
                new Date(localInputs.expired_time).getTime() / 1000,
            );
        }

        let res;
        if (isEdit) {
            res = await API.put(`/api/subscription/`, {
                ...localInputs,
                id: props.editingSubscription.id,
            });
        } else {
            res = await API.post(`/api/subscription/`, {
                ...localInputs,
            });
        }

        const { success, message } = res.data;
        if (success) {
            showSuccess(isEdit ? t('订阅更新成功！') : t('订阅创建成功！'));
            props.refresh();
            props.handleClose();
        } else {
            showError(message);
        }
        setLoading(false);
    };

    return (
        <SideSheet
            placement='right'
            title={
                <Space>
                    {isEdit ? (
                        <Tag color='blue' shape='circle'>{t('更新')}</Tag>
                    ) : (
                        <Tag color='green' shape='circle'>{t('新建')}</Tag>
                    )}
                    <Title heading={4} className='m-0'>
                        {isEdit ? t('更新订阅信息') : t('创建新订阅')}
                    </Title>
                </Space>
            }
            visible={props.visible}
            width={isMobile ? '100%' : 600}
            footer={
                <div className='flex justify-end'>
                    <Space>
                        <Button
                            theme='solid'
                            onClick={() => formApiRef.current?.submitForm()}
                            icon={<IconSave />}
                            loading={loading}
                        >
                            {t('提交')}
                        </Button>
                        <Button
                            theme='light'
                            type='primary'
                            onClick={handleCancel}
                            icon={<IconClose />}
                        >
                            {t('取消')}
                        </Button>
                    </Space>
                </div>
            }
            onCancel={handleCancel}
        >
            <Spin spinning={loading}>
                <Form
                    getFormApi={(api) => (formApiRef.current = api)}
                    onSubmit={submit}
                    labelPosition='left'
                    labelAlign='right'
                    labelWidth={150}
                >
                    {({ values }) => (
                        <div className='p-4'>
                            <Card className='!rounded-2xl shadow-sm border-0 mb-4' title={
                                <Space>
                                    <Avatar size='small' color='blue'><IconGift size={16} /></Avatar>
                                    <Text font-medium>{t('基本信息')}</Text>
                                </Space>
                            }>
                                <Form.Input field='name' label={t('名称')} placeholder={t('订阅名称')} rules={[{ required: true }]} />
                                {isAdmin() && (
                                    <Form.InputNumber field='user_id' label={t('用户ID')} placeholder={t('所属用户ID')} rules={[{ required: true }]} />
                                )}
                                <Form.DatePicker field='expired_time' label={t('过期时间')} type='dateTime' placeholder={t('留空为永久')} />
                            </Card>

                            <Card className='!rounded-2xl shadow-sm border-0 mb-4' title={
                                <Space>
                                    <Avatar size='small' color='green'><IconCreditCard size={16} /></Avatar>
                                    <Text font-medium>{t('额度与刷新')}</Text>
                                </Space>
                            }>
                                <Form.InputNumber
                                    field='daily_quota'
                                    label={t('每日额度')}
                                    extraText={renderQuotaWithPrompt(values.daily_quota || 0)}
                                    rules={[{ required: true }]}
                                />
                                <Form.TimePicker field='refresh_time' label={t('每日刷新时间')} format='HH:mm' placeholder='00:00' />
                                <Form.Switch field='allow_user_balance' label={t('允许余额支付溢出')} />
                            </Card>

                            <Card className='!rounded-2xl shadow-sm border-0' title={
                                <Space>
                                    <Avatar size='small' color='orange'><IconSetting size={16} /></Avatar>
                                    <Text font-medium>{t('使用限制')}</Text>
                                </Space>
                            }>
                                <Form.Input field='models' label={t('可用模型')} placeholder={t('英文逗号分隔，留空不限')} />
                                <Form.Input field='channels' label={t('可用渠道')} placeholder={t('英文逗号分隔，留空不限')} />
                                <Form.Input field='groups' label={t('所属分组')} placeholder={t('英文逗号分隔，留空不限')} />
                            </Card>
                        </div>
                    )}
                </Form>
            </Spin>
        </SideSheet>
    );
};

export default EditSubscriptionModal;
