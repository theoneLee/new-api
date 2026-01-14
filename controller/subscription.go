package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllSubscriptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	subscriptions, total, err := model.GetAllSubscriptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(subscriptions)
	common.ApiSuccess(c, pageInfo)
}

func GetUserSubscriptions(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	subscriptions, total, err := model.GetUserSubscriptions(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(subscriptions)
	common.ApiSuccess(c, pageInfo)
}

func SearchSubscriptions(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	subscriptions, total, err := model.SearchSubscriptions(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(subscriptions)
	common.ApiSuccess(c, pageInfo)
}

func GetSubscriptionByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	var subscription *model.Subscription
	if model.IsAdmin(userId) {
		subscription, err = model.GetSubscriptionById(id)
	} else {
		subscription, err = model.GetSubscriptionByIds(id, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subscription)
}

func AddSubscription(c *gin.Context) {
	subscription := model.Subscription{}
	err := c.ShouldBindJSON(&subscription)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if subscription.UserId == 0 || !model.IsAdmin(c.GetInt("id")) {
		subscription.UserId = c.GetInt("id")
	}
	err = subscription.Insert()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subscription)
}

func UpdateSubscription(c *gin.Context) {
	subscription := model.Subscription{}
	err := c.ShouldBindJSON(&subscription)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = subscription.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subscription)
}

func DeleteSubscription(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	subscription := model.Subscription{Id: id}
	err = subscription.Delete()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
