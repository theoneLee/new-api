package model

import (
	"errors"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Subscription struct {
	Id               int            `json:"id"`
	UserId           int            `json:"user_id" gorm:"index"`
	Name             string         `json:"name" gorm:"index"`
	Status           int            `json:"status" gorm:"default:1"` // 1: enabled, 2: disabled
	CreatedTime      int64          `json:"created_time" gorm:"bigint"`
	ExpiredTime      int64          `json:"expired_time" gorm:"bigint"` // expired time, 0 means never expired
	DailyQuota       int            `json:"daily_quota" gorm:"default:0"`
	RemainQuota      int            `json:"remain_quota" gorm:"default:0"`
	Models           string         `json:"models" gorm:"type:text"`   // allowed models, comma separated, empty means all
	Channels         string         `json:"channels" gorm:"type:text"` // allowed channels, comma separated, empty means all
	Groups           string         `json:"groups" gorm:"type:text"`   // allowed groups, comma separated, empty means all
	AllowUserBalance bool           `json:"allow_user_balance" gorm:"default:false"`
	RefreshTime      string         `json:"refresh_time" gorm:"type:varchar(64);default:'01:00'"`
	DeletedAt        gorm.DeletedAt `gorm:"index"`
}

func (subscription *Subscription) formatRefreshTime() {
	if subscription.RefreshTime == "" {
		subscription.RefreshTime = "01:00"
		return
	}
	// If it's a full ISO timestamp (contains T and Z), extract HH:mm
	if strings.Contains(subscription.RefreshTime, "T") {
		t, err := time.Parse(time.RFC3339, subscription.RefreshTime)
		if err == nil {
			subscription.RefreshTime = t.Format("15:04")
		}
	}
}

func (subscription *Subscription) GetModels() []string {
	if subscription.Models == "" {
		return []string{}
	}
	return strings.Split(subscription.Models, ",")
}

func (subscription *Subscription) GetChannels() []string {
	if subscription.Channels == "" {
		return []string{}
	}
	return strings.Split(subscription.Channels, ",")
}

func (subscription *Subscription) GetGroups() []string {
	if subscription.Groups == "" {
		return []string{}
	}
	return strings.Split(subscription.Groups, ",")
}

func GetAllSubscriptions(startIdx int, num int, sort string) ([]*Subscription, int64, error) {
	var subscriptions []*Subscription
	var total int64
	if sort == "" {
		sort = "id desc"
	}
	DB.Model(&Subscription{}).Count(&total)
	err := DB.Order(sort).Limit(num).Offset(startIdx).Find(&subscriptions).Error
	return subscriptions, total, err
}

func GetUserSubscriptions(userId int, startIdx int, num int, sort string) ([]*Subscription, int64, error) {
	var subscriptions []*Subscription
	var total int64
	if sort == "" {
		sort = "id desc"
	}
	DB.Model(&Subscription{}).Where("user_id = ?", userId).Count(&total)
	err := DB.Where("user_id = ?", userId).Order(sort).Limit(num).Offset(startIdx).Find(&subscriptions).Error
	return subscriptions, total, err
}

func SearchSubscriptions(id int, userId int, startIdx int, num int, sort string) ([]*Subscription, int64, error) {
	var subscriptions []*Subscription
	var total int64
	if sort == "" {
		sort = "id desc"
	}
	query := DB.Model(&Subscription{})

	if id > 0 {
		query = query.Where("id = ?", id)
	}
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}

	query.Count(&total)
	err := query.Order(sort).Limit(num).Offset(startIdx).Find(&subscriptions).Error
	return subscriptions, total, err
}

func GetSubscriptionById(id int) (*Subscription, error) {
	subscription := Subscription{Id: id}
	err := DB.First(&subscription, "id = ?", id).Error
	return &subscription, err
}

func GetSubscriptionByIds(id int, userId int) (*Subscription, error) {
	subscription := Subscription{Id: id, UserId: userId}
	err := DB.Where("id = ? and user_id = ?", id, userId).First(&subscription).Error
	return &subscription, err
}

func (subscription *Subscription) Insert() error {
	subscription.CreatedTime = common.GetTimestamp()
	if subscription.RemainQuota == 0 {
		subscription.RemainQuota = subscription.DailyQuota
	}
	subscription.formatRefreshTime()
	return DB.Create(subscription).Error
}

func (subscription *Subscription) Update() error {
	subscription.formatRefreshTime()
	return DB.Model(subscription).Select("*").Omit("id", "created_time", "remain_quota").Updates(subscription).Error
}

func (subscription *Subscription) Delete() error {
	if subscription.Id == 0 {
		return errors.New("id 为空！")
	}
	return DB.Delete(subscription).Error
}

func (subscription *Subscription) SelectUpdate() error {
	return DB.Model(subscription).Select("status").Updates(subscription).Error
}

func (subscription *Subscription) Match(modelName string, channelId int, group string) bool {
	// Check model restriction
	// If models is configured (non-empty), verify the requested model is in the allowed list
	models := subscription.GetModels()
	if len(models) > 0 {
		if !slices.Contains(models, modelName) {
			return false
		}
	}

	// Check channel restriction
	// If channels is configured (non-empty), verify the channel ID is in the allowed list
	channels := subscription.GetChannels()
	if len(channels) > 0 {
		channelStr := strconv.Itoa(channelId)
		if !slices.Contains(channels, channelStr) {
			return false
		}
	}

	// Check group restriction
	// If groups is configured (non-empty), verify the group is in the allowed list
	groups := subscription.GetGroups()
	if len(groups) > 0 {
		if !slices.Contains(groups, group) {
			return false
		}
	}

	return true
}

func GetActiveSubscriptionsByUserId(userId int) ([]*Subscription, error) {
	var subscriptions []*Subscription
	now := common.GetTimestamp()
	err := DB.Where("user_id = ? AND status = ? AND (expired_time = 0 OR expired_time > ?)", userId, common.SubscriptionStatusEnabled, now).Find(&subscriptions).Error
	return subscriptions, err
}

func (subscription *Subscription) DecreaseRemainingQuota(quota int) error {
	return DB.Model(subscription).Update("remain_quota", gorm.Expr("remain_quota - ?", quota)).Error
}

func (subscription *Subscription) IncreaseRemainingQuota(quota int) error {
	return DB.Model(subscription).Update("remain_quota", gorm.Expr("remain_quota + ?", quota)).Error
}

func GetSubscriptionsByRefreshTime(refreshTime string) ([]*Subscription, error) {
	var subscriptions []*Subscription
	now := common.GetTimestamp()
	err := DB.Where("status = ? AND refresh_time = ? AND (expired_time = 0 OR expired_time > ?)", common.SubscriptionStatusEnabled, refreshTime, now).Find(&subscriptions).Error
	return subscriptions, err
}
