/* global module */

const lastKnownStatusCacheKey = "lastKnownStatusCacheKey"

const status = {
    valid: "valid",
    invalid: "invalid"
}

async function setupPlugin() {
    console.info("Started plugin")
}

async function runEveryMinute({ config, cache }) {
    const isInError = await isNoEventsInPeriodAsync(config)
    const lastKnownState = await getLastKownStatus(cache)

    if (isInError && lastKnownState === status.valid) {
        await triggerAlertAsync(config, cache)
        console.warn("Triggered ingesion alert")
        return;
    }

    if (!isInError && lastKnownState === status.invalid) {
        await resolveAlertAsync(config, cache)
        console.info("Resolved ingestion alert")
        return;
    }

    if (isInError) {
        console.warn("Ingestion alert is still active")
        return;
    }

    console.info("Ingestion OK")
}

function setLastKnownStatus(cache, state) {
    cache.set(lastKnownStatusCacheKey, state)
}

async function getLastKownStatus(cache) {
    const lastKnownStatus = await cache.get(lastKnownStatusCacheKey);    
    return lastKnownStatus ?? status.valid;
}

async function isNoEventsInPeriodAsync(config) {
    const events = await getTrendAsync(config)
    return events.length == 0
}

async function getTrendAsync(config) {
    const response = await fetch(buildEventsApiUrl(config.posthogHost, config.timeRange), {
        headers: {
            authorization: `Bearer ${config.posthogApiKey}`
        }
    })

    if (!response.ok) {
        throw Error(`Error from PostHog API: status=${response.status} response=${await response.text()}`)
    }

    const body = await response.json()
    return body.results
}

async function triggerAlertAsync(config, cache) {
    await triggerWebHookAsync(config, status.invalid)
    await setLastKnownStatus(cache, status.invalid)
}

async function resolveAlertAsync(config, cache) {
    await triggerWebHookAsync(config, status.valid)
    await setLastKnownStatus(cache, status.valid)
}

async function triggerWebHookAsync(config, currentStatus) {
    let title = "";
    let message = "";
    let themeColor = "";

    let webHookUrl = config.webHookUrl;
  
    if (currentStatus === status.valid) {
        title = "Ingestion error resolved"
        message = "System detected event ingestion"
        themeColor = "00FF00"        
    } else {
        title = "Ingestion error detected"
        message = `System did not ingest any events in at least ${parseInt(config.timeRange)} minutes`
        themeColor = "FF0000"
    }

    const card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": themeColor,       
        "title": title,
        "text": message,
    };

    const response = await fetch(webHookUrl, {
        method: "post",
        body: JSON.stringify(card),
        headers: {
            "content-type": "application/vnd.microsoft.teams.card.o365connector"
        },
    })

    if (!response.ok) {
        throw Error(`Error from WebHook: status=${response.status} response=${await response.text()}`)
    }

    return response
}

function buildEventsApiUrl(instanceURL, timeRange) {
    let time_from = new Date(Date.now() - (parseInt(timeRange) * 60 * 1000)).toISOString()
    let url = new URL(`${instanceURL}/api/event?after=${time_from}`)
    url.searchParams.set("refresh", "true")
    return url.href
}

module.exports = {
    setupPlugin,
    runEveryMinute
}
