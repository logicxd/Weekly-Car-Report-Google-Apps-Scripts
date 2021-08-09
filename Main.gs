
//////////// Configs ////////////

let Config = {
  "pricePerKWh": 0.16,
  "processedLabelName": "Automated/Processed",
  "notion": {
    "api_key": "",
    "bill_database_id": ""
  }
}

/*
 * Set variables in the `start()` method 
 */
let GlobalVars = {
  afterDate: null,
  emailScripts: null
}

/*
 * Must call this in the beginning of "start" method, otherwise some variables will not have been loaded
 */
function setupGlobalVars() {
  GlobalVars.afterDate = Utils.afterDate()
  GlobalVars.emailScripts = [tezlab]
}

//////////// Start ////////////

function start() {
  setupGlobalVars()
  createProcessedLabelIfNeeded()
  const labelsMap = getLabels()
  const labelIds = filterLabelsBasedOnEmailScripts(labelsMap)
  const messages = getEmailMessages(labelIds)
  const messageDetails = getMessageDetails(messages, labelIds, labelsMap[Config.processedLabelName])
  const parsedData = parseEmails(messageDetails)
  addEntryIntoNotion(parsedData)
  applyProcessedLabelIfNeeded(labelsMap, messages)
}

//////////// Helpers ////////////

function createProcessedLabelIfNeeded() {
  if (!Config.processedLabelName) { return }

  try {
    Gmail.Users.Labels.create({
      name: Config.processedLabelName,
      type: 'user',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      color: {
        textColor: '#04502e',
        backgroundColor: '#a2dcc1'
      }
    }, 'me')
  } catch (error) {
    if (!error) {
      console.log(`Label "${Config.email.processedLabelName}" created`)
    } else if (error.details.code == 409) {
      // Label already exists - no action needed
    } else {
      console.log(`Error while creating label: ${error.message}`)
    }
  }
}

function getLabels() {
  const object = Gmail.Users.Labels.list('me')
  const labels = object.labels

  let labelsMap = {}
  for (const label of labels) {
    let name = label['name']
    let id = label['id']
    labelsMap[name] = id
  }
  return labelsMap
}

function filterLabelsBasedOnEmailScripts(labelsMap) {
  const labelIds = []
  GlobalVars.emailScripts.forEach(script => {
    const labelName = script.labelName
    if (labelName != null && labelsMap[labelName]) {
      const labelId = labelsMap[labelName]
      script.labelId = labelId
      labelIds.push(labelId)
    }
  })
  return labelIds
}

function getEmailMessages(labelIds) {
  const messages = []
  const q = `after:${GlobalVars.afterDate.format('YYYY/MM/DD')}`
  for (const labelId of labelIds) {
    let output = Gmail.Users.Messages.list('me', {
      labelIds: labelId,
      q: q
    })

    if (output.messages) {
      messages.push(...output.messages)
    }
  }
  return messages
}

function getMessageDetails(messages, labelIds, processedLabelId) {
  if (!messages) {
    throw ('Failed to get email message details')
  }

  let messageDetails = {}
  labelIds = new Set(labelIds)
  for (const message of messages) {
    let messageDetail = Gmail.Users.Messages.get('me', message.id)
    if (!messageDetail || !messageDetail.payload) {
      continue
    }
    if (processedLabelId && messageDetail.labelIds.includes(processedLabelId)) {
      console.warn(`Skipping email id ${messageDetail.id} since it has already been processed`)
      continue
    }

    const object = {
      'id': messageDetail.id,
      'payload': messageDetail.payload
    }
    for (const labelId of messageDetail.labelIds) {
      if (labelIds.has(labelId)) {
        object.labelId = labelId
        break
      }
    }
    let parts = messageDetail.payload.parts ? messageDetail.payload.parts : [messageDetail.payload]
    for (const rootPart of parts) {
      switch (rootPart.mimeType) {
        case 'text/plain':
          object.body = rootPart.body.data
          break
      }
    }

    if (!messageDetails[object.labelId]) {
      messageDetails[object.labelId] = []
    }
    messageDetails[object.labelId].push(object)
  }
  return messageDetails
}

function parseEmails(messageDetails) {
  let parsedEmails = []
  for (const emailScript of GlobalVars.emailScripts) {
    console.info(`Parsing email script: ${emailScript.displayName}`)

    const emails = messageDetails[emailScript.labelId]
    if (emails && emails.length > 0) {
      for (const email of emails) {
        let parsedEmail = emailScript.parse(email)
        if (parsedEmail) {
          parsedEmail.displayName = emailScript.displayName
          parsedEmails.push(parsedEmail)
        }
      }
    } else {
      let parsedEmail = emailScript.parse(null)
      if (parsedEmail) {
        parsedEmail.displayName = emailScript.displayName
        parsedEmails.push(parsedEmail)
      }
    }
  }
  return parsedEmails
}

function applyProcessedLabelIfNeeded(labelsMap, messages) {
  const labelId = labelsMap[Config.processedLabelName]
  if (!labelId) { return }1

  for (const message of messages) {
    Gmail.Users.Messages.modify({ addLabelIds: [labelId] }, 'me', message.id)
  }
}

//////////// Notion ////////////

function addEntryIntoNotion(parsedData) {
  if (!Config.notion.api_key) { return }

  for (const data of parsedData) {
    // const title = moment().subtract(1, 'months').format('MMMM YYYY')

    var url = "https://api.notion.com/v1/pages"
    var postData = {
      "parent": {
        "database_id": Config.notion.bill_database_id
      },
      "properties": {
        // "Report": {
        //   "title": [
        //     {
        //       "text": {
        //         "content": title
        //       }
        //     }
        //   ]
        // }, 
        "Miles Driven": {
          "number": data.milesDriven
        },
        "Energy Added (kWh)": {
          "number": data.energyAdded
        },
        "Date": {
          "date": {
            "start": moment(data.startDate, 'MMM D').format('YYYY-MM-DD'),
            "end": moment(data.endDate, 'MMM D').format('YYYY-MM-DD')
          }
        },
        "Price per kWh": {
          "number": Config.pricePerKWh
        }
      }
    }
    var options = {
      'method': 'POST',
      'contentType': 'application/json',
      'headers': {
          'Authorization': `Bearer ${Config.notion.api_key}`,
          'Notion-Version': '2021-05-13'
      },
      'payload': JSON.stringify(postData)
    }
    UrlFetchApp.fetch(url, options)
  }
}







