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
import CardPro from '../../common/ui/CardPro';
import SubscriptionsTable from './SubscriptionsTable';
import SubscriptionsActions from './SubscriptionsActions';
import SubscriptionsFilters from './SubscriptionsFilters';
import SubscriptionsDescription from './SubscriptionsDescription';
import EditSubscriptionModal from './modals/EditSubscriptionModal';
import { useSubscriptionsData } from '../../../hooks/subscription/useSubscriptionsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const SubscriptionsPage = () => {
    const subscriptionsData = useSubscriptionsData();
    const isMobile = useIsMobile();

    const {
        // Edit state
        showEdit,
        editingSubscription,
        closeEdit,
        refresh,

        // Actions state
        selectedKeys,
        setEditingSubscription,
        setShowEdit,

        // Filters state
        formInitValues,
        setFormApi,
        searchSubscriptions,
        loading,
        searching,

        // UI state
        compactMode,
        setCompactMode,

        // Translation
        t,
    } = subscriptionsData;

    return (
        <>
            <EditSubscriptionModal
                refresh={refresh}
                editingSubscription={editingSubscription}
                visible={showEdit}
                handleClose={closeEdit}
            />

            <CardPro
                type='type1'
                descriptionArea={
                    <SubscriptionsDescription
                        compactMode={compactMode}
                        setCompactMode={setCompactMode}
                        t={t}
                    />
                }
                actionsArea={
                    <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
                        <SubscriptionsActions
                            selectedKeys={selectedKeys}
                            setEditingSubscription={setEditingSubscription}
                            setShowEdit={setShowEdit}
                            t={t}
                        />

                        <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
                            <SubscriptionsFilters
                                formInitValues={formInitValues}
                                setFormApi={setFormApi}
                                searchSubscriptions={searchSubscriptions}
                                loading={loading}
                                searching={searching}
                                t={t}
                            />
                        </div>
                    </div>
                }
                paginationArea={createCardProPagination({
                    currentPage: subscriptionsData.activePage,
                    pageSize: subscriptionsData.pageSize,
                    total: subscriptionsData.subscriptionCount,
                    onPageChange: subscriptionsData.handlePageChange,
                    onPageSizeChange: subscriptionsData.handlePageSizeChange,
                    isMobile: isMobile,
                    t: t,
                })}
                t={t}
            >
                <SubscriptionsTable {...subscriptionsData} />
            </CardPro>
        </>
    );
};

export default SubscriptionsPage;
