package service

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func ReturnPreConsumedQuota(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if relayInfo.FinalPreConsumedQuota != 0 {
		logger.LogInfo(c, fmt.Sprintf("用户 %d 请求失败, 返还预扣费额度 %s", relayInfo.UserId, logger.FormatQuota(relayInfo.FinalPreConsumedQuota)))
		gopool.Go(func() {
			relayInfoCopy := *relayInfo

			err := PostConsumeQuota(&relayInfoCopy, -relayInfoCopy.FinalPreConsumedQuota, 0, false)
			if err != nil {
				common.SysLog("error return pre-consumed quota: " + err.Error())
			}
		})
	}
}

// PreConsumeQuota checks if the user has enough quota to pre-consume.
// It returns the pre-consumed quota if successful, or an error if not.
// Priority: Subscription quota > User balance
func PreConsumeQuota(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}

	trustQuota := common.GetTrustQuota()
	relayInfo.UserQuota = userQuota

	// Check subscription first (subscription has higher priority than user balance)
	subscriptions, err := model.GetActiveSubscriptionsByUserId(relayInfo.UserId)
	if err == nil && len(subscriptions) > 0 {
		channelId := 0
		if relayInfo.ChannelMeta != nil {
			channelId = relayInfo.ChannelMeta.ChannelId
		}
		var anyMatched bool
		var anyAllowFallBack bool
		for _, sub := range subscriptions {
			if sub.Match(relayInfo.OriginModelName, channelId, relayInfo.TokenGroup) {
				anyMatched = true
				if sub.RemainQuota >= preConsumedQuota {
					// Use subscription quota - no need to check user balance
					relayInfo.SubscriptionId = sub.Id
					relayInfo.UseSubscription = true
					relayInfo.SubscriptionAllowUserBalance = sub.AllowUserBalance
					preConsumedQuota = 0 // Don't pre-consume from user balance
					logger.LogInfo(c, fmt.Sprintf("用户 %d 使用订阅 %d (%s) 额度, 剩余订阅额度: %s", relayInfo.UserId, sub.Id, sub.Name, logger.FormatQuota(sub.RemainQuota)))
					// Skip user balance check, go directly to final processing
					goto finalProcess
				}
				// Subscription matched but not enough quota
				logger.LogInfo(c, fmt.Sprintf("用户 %d 订阅 %d (%s) 额度不足 (%s < %s), 尝试下一个订阅", relayInfo.UserId, sub.Id, sub.Name, logger.FormatQuota(sub.RemainQuota), logger.FormatQuota(preConsumedQuota)))
				if sub.AllowUserBalance {
					anyAllowFallBack = true
				}
			}
		}

		// If we found matched subscriptions but none had enough quota
		if anyMatched {
			if !anyAllowFallBack {
				// None allowed fallback, so we must fail
				return types.NewErrorWithStatusCode(fmt.Errorf("用户可用订阅额度均不足且不允许使用主余额, 需要额度: %s", logger.FormatQuota(preConsumedQuota)), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
			}
			logger.LogInfo(c, fmt.Sprintf("用户 %d 所有匹配订阅额度均不足, 但存在允许使用余额的订阅, 转为使用主余额", relayInfo.UserId))
		}
	}

	// No subscription matched or subscription quota insufficient, check user balance
	if userQuota <= 0 {
		return types.NewErrorWithStatusCode(fmt.Errorf("用户额度不足, 剩余额度: %s", logger.FormatQuota(userQuota)), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}
	if userQuota-preConsumedQuota < 0 {
		return types.NewErrorWithStatusCode(fmt.Errorf("预扣费额度失败, 用户剩余额度: %s, 需要预扣费额度: %s", logger.FormatQuota(userQuota), logger.FormatQuota(preConsumedQuota)), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}

finalProcess:

	if userQuota > trustQuota {
		// 用户额度充足，判断令牌额度是否充足
		if !relayInfo.TokenUnlimited {
			// 非无限令牌，判断令牌额度是否充足
			tokenQuota := c.GetInt("token_quota")
			if tokenQuota > trustQuota {
				// 令牌额度充足，信任令牌
				preConsumedQuota = 0
				logger.LogInfo(c, fmt.Sprintf("用户 %d 剩余额度 %s 且令牌 %d 额度 %d 充足, 信任且不需要预扣费", relayInfo.UserId, logger.FormatQuota(userQuota), relayInfo.TokenId, tokenQuota))
			}
		} else {
			// in this case, we do not pre-consume quota
			// because the user has enough quota
			preConsumedQuota = 0
			logger.LogInfo(c, fmt.Sprintf("用户 %d 额度充足且为无限额度令牌, 信任且不需要预扣费", relayInfo.UserId))
		}
	}

	if preConsumedQuota > 0 {
		err := PreConsumeTokenQuota(relayInfo, preConsumedQuota)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		err = model.DecreaseUserQuota(relayInfo.UserId, preConsumedQuota)
		if err != nil {
			return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
		logger.LogInfo(c, fmt.Sprintf("用户 %d 预扣费 %s, 预扣费后剩余额度: %s", relayInfo.UserId, logger.FormatQuota(preConsumedQuota), logger.FormatQuota(userQuota-preConsumedQuota)))
	}
	relayInfo.FinalPreConsumedQuota = preConsumedQuota
	return nil
}
