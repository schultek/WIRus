const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_MONTH = ONE_DAY * 30;
const ONE_YEAR = ONE_DAY * 365;
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

exports.ONE_HOUR = ONE_HOUR;
exports.ONE_DAY = ONE_DAY;
exports.ONE_MONTH = ONE_MONTH;
exports.ONE_YEAR = ONE_YEAR;
exports.WEEKDAYS = WEEKDAYS;
exports.MONTHS = MONTHS;


function getYearDiff(d1, d2) {
  return d2.getFullYear() - d1.getFullYear();
}

function getMonthDiff(d1, d2) {
  let m1 = d1.getFullYear() * 12 + d1.getMonth()
  let m2 = d2.getFullYear() * 12 + d2.getMonth()
  return m2 - m1;
}

function isLeapYear(d) {
  var year = d.getFullYear();
  if ((year & 3) != 0) return false;
  return ((year % 100) != 0 || (year % 400) == 0);
}

function getDOY(d) {
  var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var mn = d.getMonth();
  var dn = d.getDate();
  var dayOfYear = dayCount[mn] + dn;
  if(mn > 1 && isLeapYear(d)) dayOfYear++;
  return dayOfYear;
}

function getDayDiff(d1, d2) {
  if (d1.getFullYear() == d2.getFullYear()) {
    return getDOY(d2) - getDOY(d1);
  } else {
    if (isLeapYear(d1)) return getDOY(d2) + 366 - getDOY(d1);
    else return getDOY(d2) + 365 - getDOY(d1);
  }
}

exports.getUnitForInterval = function (interval) {

  if (interval > ONE_YEAR) {
    return "year";
  } else if (interval > ONE_MONTH * 3) {
    return "month";
  } else if (interval > ONE_DAY * 6) {
    return "date";
  } else {
    return "weekday";
  }
}

exports.correctForEvenDifference = function (start, end, unit) {
  switch (unit) {
    case "year":
      return getYearDiff(new Date(start), new Date(end)) % 2 == 1 ? start - ONE_YEAR : start;
    case "month":
      return getMonthDiff(new Date(start), new Date(end)) % 2 == 1 ? start - ONE_MONTH : start;
    case "date":
    case "weekday":
      return getDayDiff(new Date(start), new Date(end)) % 2 == 1 ? start - ONE_DAY : start;
    default:
      return start;
  }
}

exports.getLabel = function (d, unit) {
  switch (unit) {
    case "weekday":
      return WEEKDAYS[d.getDay()];
    case "date":
      return d.getDate() + ". " + MONTHS[d.getMonth()];
    case "month":
      return MONTHS[d.getMonth()];
    case "year":
      return "" + d.getFullYear();
    default:
      return null;
  }
}