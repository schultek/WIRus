
exports.getLevel = function(score) {

  if (score < 10) {
    return {
      status: 0,
      progress: score / 10
    }
  } else if (score < 25) {
    return {
      status: 1,
      progress: (score - 10) / 15
    }
  } else if (score < 50) {
    return {
      status: 2,
      progress: (score - 25) / 25
    }
  } else if (score < 100) {
    return {
      status: 3,
      progress: (score - 50) / 50
    }
  } else if (score < 200) {
    return {
      status: 4,
      progress: (score - 100) / 100
    }
  } else {
    return {
      status: 5,
      progress: -1
    }
  }

}

const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_MONTH = ONE_DAY * 30;
const ONE_YEAR = ONE_DAY * 365;
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

exports.getSlope = function(score, actions) {

    const MIN_POINTS = 10;
    const MAX_POINTS = 200;
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
      let intervalFrame = Date.now() - intervalStart;

      let intervalUnit;
      if (intervalFrame > ONE_YEAR) {
        intervalUnit = "year";
        // TODO test for event year difference
      } else if (intervalFrame > ONE_MONTH * 3) {
        intervalUnit = "month";
        // TODO test for even month difference
      } else if (intervalFrame > ONE_DAY * 6) {
        intervalUnit = "date";
        // TODO test for even date difference
      } else {
        intervalUnit = "weekday";
        // TODO test for even day difference
      }

      let bars = [0];

      let intervalStep = Math.ceil(intervalFrame / NUM_BARS);

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

      let getLabel = (time, unit) => {
        let date = new Date(time);
        switch (unit) {
          case "weekday":
            return WEEKDAYS[date.getDay()];
          case "date":
            return date.getDate() + ". " + MONTHS[date.getMonth()];
          case "month":
            return MONTHS[date.getMonth()];
          case "year":
            return "" + date.getFullYear();
          default:
            return null;
        }
      }

      return {
        bars,
        labels: {
          start: getLabel(intervalStart, intervalUnit),
          mid: getLabel((Date.now() + intervalStart) / 2, intervalUnit),
          end: getLabel(Date.now(), intervalUnit)
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