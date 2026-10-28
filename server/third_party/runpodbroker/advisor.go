package runpodbroker

// Placement is where steady work should live.
type Placement string

const (
	PlaceServerless Placement = "serverless"
	PlacePod        Placement = "pod"
)

// Recommend chooses between serverless and a dedicated pod from observed
// utilisation (busy seconds / wall seconds over a recent window). The break-even
// utilisation is podRate/serverlessRate; a pod only pays above it, so promote
// with a margin and demote well below it to avoid flapping.
func Recommend(current Placement, util, podPerHr, serverlessPerHr float64) Placement {
	if serverlessPerHr <= 0 || podPerHr <= 0 {
		return current
	}
	breakEven := podPerHr / serverlessPerHr
	switch current {
	case PlacePod:
		if util < breakEven*0.6 {
			return PlaceServerless
		}
		return PlacePod
	default:
		if util >= breakEven*1.2 {
			return PlacePod
		}
		return PlaceServerless
	}
}
