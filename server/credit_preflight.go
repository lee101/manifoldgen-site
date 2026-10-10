package main

import (
	"fmt"
	"math"
	"net/http"

	"github.com/valyala/fasthttp"
)

const meteredPreflightShare = 0.6

func creditsShortForEstimate(user *User, estimatedUSD, share float64) (needUSD, haveUSD float64, short bool) {
	if user == nil || user.UnlimitedAPI || estimatedUSD <= 0 {
		return 0, 0, false
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		return 0, 0, false
	}
	needUSD = estimatedUSD * share
	haveUSD = user.Credits * cutePrice
	return needUSD, haveUSD, haveUSD+1e-9 < needUSD
}

func rejectCreditsBelowEstimate(ctx *fasthttp.RequestCtx, user *User, estimatedUSD, share float64) bool {
	needUSD, haveUSD, short := creditsShortForEstimate(user, estimatedUSD, share)
	if !short {
		return false
	}
	servicePaywallError(ctx, http.StatusPaymentRequired, paywallCodeSubscriptionRequired,
		fmt.Sprintf("insufficient credits: need about $%.2f, have $%.2f", needUSD, haveUSD))
	return true
}
