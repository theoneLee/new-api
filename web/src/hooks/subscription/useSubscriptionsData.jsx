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

import { useState, useEffect } from 'react';
import { API, showError, showSuccess, copy, isAdmin } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
    SUBSCRIPTION_ACTIONS,
    SUBSCRIPTION_STATUS,
} from '../../constants/subscription.constants';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useSubscriptionsData = () => {
    const { t } = useTranslation();

    // Basic state
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [activePage, setActivePage] = useState(1);
    const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
    const [subscriptionCount, setSubscriptionCount] = useState(0);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [sort, setSort] = useState('');

    // Edit state
    const [editingSubscription, setEditingSubscription] = useState({
        id: undefined,
    });
    const [showEdit, setShowEdit] = useState(false);

    // Form API
    const [formApi, setFormApi] = useState(null);

    // UI state
    const [compactMode, setCompactMode] = useTableCompactMode('subscriptions');

    // Form state
    const formInitValues = {
        searchId: '',
        searchUserId: '',
    };

    // Get form values
    const getFormValues = () => {
        const formValues = formApi ? formApi.getValues() : {};
        return {
            searchId: formValues.searchId || '',
            searchUserId: formValues.searchUserId || '',
        };
    };

    // Load subscription list
    const loadSubscriptions = async (page = 1, size = pageSize, currentSort = sort) => {
        setLoading(true);
        try {
            const endpoint = isAdmin() ? '/api/subscription/' : '/api/subscription/self';
            const res = await API.get(
                `${endpoint}?p=${page}&page_size=${size}&sort=${currentSort}`,
            );
            const { success, message, data } = res.data;
            if (success) {
                if (Array.isArray(data)) {
                    setSubscriptions(data);
                    setSubscriptionCount(data.length);
                } else {
                    setSubscriptions(data.items || []);
                    setActivePage(data.page <= 0 ? 1 : data.page);
                    setSubscriptionCount(data.total || 0);
                }
            } else {
                showError(message);
            }
        } catch (error) {
            showError(error.message);
        }
        setLoading(false);
    };

    // Search subscriptions (Admin only)
    const searchSubscriptions = async (currentSort = sort) => {
        if (!isAdmin()) return;

        const actualSort = typeof currentSort === 'string' ? currentSort : sort;

        const { searchId, searchUserId } = getFormValues();
        if (searchId === '' && searchUserId === '') {
            await loadSubscriptions(1, pageSize, actualSort);
            return;
        }

        setSearching(true);
        try {
            const res = await API.get(
                `/api/subscription/search?id=${searchId}&user_id=${searchUserId}&p=1&page_size=${pageSize}&sort=${actualSort}`,
            );
            const { success, message, data } = res.data;
            if (success) {
                if (Array.isArray(data)) {
                    setSubscriptions(data);
                    setSubscriptionCount(data.length);
                } else {
                    setSubscriptions(data.items || []);
                    setActivePage(data.page || 1);
                    setSubscriptionCount(data.total || 0);
                }
            } else {
                showError(message);
            }
        } catch (error) {
            showError(error.message);
        }
        setSearching(false);
    };

    // Manage subscriptions (CRUD operations)
    const manageSubscription = async (id, action, record) => {
        setLoading(true);
        let res;

        try {
            switch (action) {
                case SUBSCRIPTION_ACTIONS.DELETE:
                    res = await API.delete(`/api/subscription/${id}`);
                    break;
                case SUBSCRIPTION_ACTIONS.ENABLE:
                    res = await API.put(`/api/subscription/`, { ...record, status: SUBSCRIPTION_STATUS.ENABLED });
                    break;
                case SUBSCRIPTION_ACTIONS.DISABLE:
                    res = await API.put(`/api/subscription/`, { ...record, status: SUBSCRIPTION_STATUS.DISABLED });
                    break;
                default:
                    throw new Error('Unknown operation type');
            }

            const { success, message } = res.data;
            if (success) {
                showSuccess(t('操作成功完成！'));
                await refresh();
            } else {
                showError(message);
            }
        } catch (error) {
            showError(error.message);
        }
        setLoading(false);
    };

    // Refresh data
    const refresh = async (page = activePage) => {
        const { searchId, searchUserId } = getFormValues();
        if (!isAdmin() || (searchId === '' && searchUserId === '')) {
            await loadSubscriptions(page, pageSize, sort);
        } else {
            await searchSubscriptions();
        }
    };

    // Handle page change
    const handlePageChange = (page) => {
        setActivePage(page);
        const { searchId, searchUserId } = getFormValues();
        if (!isAdmin() || (searchId === '' && searchUserId === '')) {
            loadSubscriptions(page, pageSize, sort);
        } else {
            searchSubscriptions();
        }
    };

    // Handle page size change
    const handlePageSizeChange = (size) => {
        setPageSize(size);
        setActivePage(1);
        const { searchId, searchUserId } = getFormValues();
        if (!isAdmin() || (searchId === '' && searchUserId === '')) {
            loadSubscriptions(1, size, sort);
        } else {
            searchSubscriptions();
        }
    };

    // Handle table change (sorting)
    // Semi Design onChange signature: (changeInfo: { pagination, filters, sorter, extra }) => void
    const handleTableChange = ({ sorter }) => {
        if (sorter) {
            let sortStr = '';
            if (sorter.sortOrder) {
                const field = sorter.dataIndex === 'id' ? 'id' : sorter.dataIndex;
                const order = sorter.sortOrder === 'descend' ? 'desc' : 'asc';
                sortStr = `${field} ${order}`;
            }
            setSort(sortStr);
            const { searchId, searchUserId } = getFormValues();
            if (!isAdmin() || (searchId === '' && searchUserId === '')) {
                loadSubscriptions(activePage, pageSize, sortStr);
            } else {
                searchSubscriptions(sortStr);
            }
        }
    };

    // Row selection configuration
    const rowSelection = {
        onChange: (selectedRowKeys, selectedRows) => {
            setSelectedKeys(selectedRows);
        },
    };

    // Copy text
    const copyText = async (text) => {
        if (await copy(text)) {
            showSuccess(t('已复制到剪贴板！'));
        } else {
            Modal.error({
                title: t('无法复制到剪贴板，请手动复制'),
                content: text,
                size: 'large',
            });
        }
    };

    // Close edit modal
    const closeEdit = () => {
        setShowEdit(false);
        setTimeout(() => {
            setEditingSubscription({
                id: undefined,
            });
        }, 500);
    };

    // Initialize data loading
    useEffect(() => {
        loadSubscriptions(1, pageSize)
            .catch((reason) => {
                showError(reason);
            });
    }, [pageSize]);

    return {
        subscriptions,
        loading,
        searching,
        activePage,
        pageSize,
        subscriptionCount,
        selectedKeys,
        editingSubscription,
        showEdit,
        formApi,
        formInitValues,
        compactMode,
        setCompactMode,
        loadSubscriptions,
        searchSubscriptions,
        manageSubscription,
        refresh,
        copyText,
        setActivePage,
        setPageSize,
        setSelectedKeys,
        setEditingSubscription,
        setShowEdit,
        setFormApi,
        setLoading,
        handlePageChange,
        handlePageSizeChange,
        handleTableChange,
        rowSelection,
        closeEdit,
        getFormValues,
        t,
    };
};
