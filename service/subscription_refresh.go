package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func SubscriptionRefreshTask() {
	for {
		now := time.Now()
		currentTimeStr := now.Format("15:04")
		currentDateStr := now.Format("2006-01-02")

		subscriptions, err := model.GetSubscriptionsByRefreshTime(currentTimeStr)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to get subscriptions to refresh: %v", err))
		} else {
			for _, sub := range subscriptions {
				key := fmt.Sprintf("subscription_refresh:%d", sub.Id)
				lastRefreshDate, _ := common.RedisGet(key)
				if lastRefreshDate == currentDateStr {
					continue
				}

				// Refresh quota
				sub.RemainQuota = sub.DailyQuota
				err = sub.Update()
				if err != nil {
					common.SysError(fmt.Sprintf("Failed to refresh subscription %d quota: %v", sub.Id, err))
					continue
				}

				// Mark as refreshed today in Redis (expire after 48 hours to be safe)
				if common.RedisEnabled {
					_ = common.RedisSet(key, currentDateStr, 48*time.Hour)
				}
				// Note: If Redis is not enabled, this task might refresh every second within that minute.
				// So we should add a second check or use a local cache.
			}
		}

		time.Sleep(1 * time.Minute)
	}
}
