
const {
  getUnitForInterval,
  correctForEvenDifference,
  getLabel
} = require("./date");

/**
 * Calculates the score of a user from a
 * provided list of actions
 */
exports.getScore = function(actions) {
  return actions // sum up all points of completed actions
    .filter(d => d.isCompleted)
    .map(d => d.points)
    .reduce((sum, d) => sum + d, 0);
}

/**
 * Calculates the rank of a user from
 * its score.
 * // TODO: also use its trophies
 */
exports.getRank = function(score) {

  if (score < 10) {
    return {
      level: 0,
      progress: score / 10
    }
  } else if (score < 25) {
    return {
      level: 1,
      progress: (score - 10) / 15
    }
  } else if (score < 50) {
    return {
      level: 2,
      progress: (score - 25) / 25
    }
  } else if (score < 100) {
    return {
      level: 3,
      progress: (score - 50) / 50
    }
  } else if (score < 200) {
    return {
      level: 4,
      progress: (score - 100) / 100
    }
  } else {
    return {
      level: 5,
      progress: -1
    }
  }
}

/**
 * Gets the slope of a users score to be shown
 * in a graph. Dynamically adjusts the timeframe
 * of the graph to show a meaningful development
 * of the score.
 */
exports.getSlope = function(score, actions) {

    const MIN_POINTS = 100;
    const MAX_POINTS = 5000;
    const MIN_RANGE = 0.2;
    const NUM_BARS = 10;

    let range = Math.min(Math.max((score - MIN_POINTS) / (MAX_POINTS - MIN_POINTS) * (MIN_RANGE - 1) + 1, MIN_RANGE), 1);

    let actionsSorted = actions.filter(d => d.isCompleted).sort((a, b) => a.completedAt - b.completedAt);

    let actionsInSlope = [];
    let sumPointsInSlope = 0;

    for (let action of actionsSorted) {
      if (sumPointsInSlope + action.points < score * range) {
        sumPointsInSlope += action.points;
        actionsInSlope.push(action);
      } else {
        break;
      }
    }

    if (actionsInSlope.length > 0) {

      let intervalStart = actionsInSlope[actionsInSlope.length - 1].completedAt;
      let intervalEnd = Date.now();
      let intervalFrame = intervalEnd - intervalStart;

      let intervalUnit = getUnitForInterval(intervalFrame);
      intervalStart = correctForEvenDifference(intervalStart, intervalEnd, intervalUnit);
      let intervalStep = Math.ceil(intervalFrame / NUM_BARS);

      let bars = [0];

      let currentBarIndex = 0;

      for (let i = actionsInSlope.length - 1; i >= 0; i--) {
        let action = actionsInSlope[i];

        if (action.completedAt > intervalStart + intervalStep * (currentBarIndex + 1)) {
          currentBarIndex++;
          bars[currentBarIndex] = bars[currentBarIndex - 1];
        }

        bars[currentBarIndex] += action.points / sumPointsInSlope;

      }

      while (currentBarIndex < NUM_BARS - 1) {
        currentBarIndex++;
        bars[currentBarIndex] = bars[currentBarIndex - 1];
      }

      return {
        bars,
        labels: {
          start: getLabel(intervalStart, intervalUnit),
          mid: getLabel((intervalEnd + intervalStart) / 2, intervalUnit),
          end: getLabel(intervalEnd, intervalUnit)
        },
        range: {
          from: score - sumPointsInSlope,
          to: score
        }
      }
    } else {
      return {
        bars: new Array(NUM_BARS).fill(0),
        labels: {
          start: "",
          mid: "",
          end: ""
        },
        range: {
          from: 0,
          to: 0
        }
      }
    }
}