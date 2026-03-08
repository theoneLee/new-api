package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func SubscriptionRefreshTask() {
	var lastRefreshMap = make(map[int]string)
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
				var lastRefreshDate string
				if common.RedisEnabled {
					lastRefreshDate, _ = common.RedisGet(key)
				} else {
					lastRefreshDate = lastRefreshMap[sub.Id]
				}

				if lastRefreshDate == currentDateStr {
					continue
				}

				// Refresh quota
				sub.RemainQuota = sub.DailyQuota
				err = sub.ResetDailyQuota()
				if err != nil {
					common.SysError(fmt.Sprintf("Failed to refresh subscription %d quota: %v", sub.Id, err))
					continue
				}

				// Mark as refreshed today
				if common.RedisEnabled {
					_ = common.RedisSet(key, currentDateStr, 48*time.Hour)
				} else {
					lastRefreshMap[sub.Id] = currentDateStr
				}
			}
		}

		// Calculate sleep time to the start of the next minute to avoid timing drift
		next := now.Add(time.Minute)
		next = time.Date(next.Year(), next.Month(), next.Day(), next.Hour(), next.Minute(), 0, 0, next.Location())
		time.Sleep(time.Until(next))
	}
}
