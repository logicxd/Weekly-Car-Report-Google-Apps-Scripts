const tezlab = {
  displayName: 'TezLab',
  labelName: 'Automated/Tesla/TezLab',
  parse: function (messageDetail) {

    function grabMilesDriven(text) {
      let split = text.split('mi')
      let textContainingMilesDriven = split[0]
      let splitByNewLine = textContainingMilesDriven.split('\n')
      let milesDriven = splitByNewLine[splitByNewLine.length-1]
      return parseInt(milesDriven)
    }

    function grabEnergyAdded(text) {
      let split = text.split('kWh')
      let textContainingEnergyAdded = split[0]
      let splitByNewLine = textContainingEnergyAdded.split('\n')
      let energyAdded = splitByNewLine[splitByNewLine.length-1]
      return parseInt(energyAdded)
    }

    function grabDates(text) {
      let split = text.split('the week of ')
      let textContainingTheWeek = split[1]
      let splitByNewLine = textContainingTheWeek.split('\n')
      let splitByDash = splitByNewLine[0].split(' - ')
      let startDate = splitByDash[0].trim()
      let endDate = splitByDash[1].trim()
      return [startDate, endDate]
    }

    if (!messageDetail) {
      console.warn('No data found for TezLab')
      return null
    }
    
    let blob = Utilities.newBlob(messageDetail.body)
    let text = blob.getDataAsString()
    let [startDate, endDate] = grabDates(text)
    let parsedObject = {
      milesDriven: grabMilesDriven(text),
      energyAdded: grabEnergyAdded(text),
      startDate: startDate,
      endDate: endDate
    }
    return parsedObject
  }
}
