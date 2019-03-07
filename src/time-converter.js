const ms = {
  hour: ms => (Number(ms) / 60000) / 60
}

const minutes = {
  ms: minutes => Number(minutes) * 0.6e+5
}

const hour =  {
  minutes: hour => Number(hour) * 60,
  ms: hour => Number(hour) * 3.6e+6
}

export default {
  ms,
  hour,
  minutes
}
