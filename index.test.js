const { createEvent, createIdentify, getMeta, resetMeta, clone } = require("@posthog/plugin-scaffold/test/utils");
const { runEveryMinute } = require("./index");

function setMeta(lastKownState) {
    resetMeta({
        config: {
            timeRange: 30,
            posthogHost: "https://app.posthog.com",
            webHookUrl: "https://webhook.url",
            posthogApiKey: "apiKey"
        },
        cache: {
            get: () => lastKownState,
            set: () => { }
        }
    });
}

beforeEach(() => {
    setMeta("valid")    
    fetch.resetMocks()
});

function assertEventsApiCalled() {
    const url = new URL(`https://app.posthog.com/api/event?after=${new Date('2020-01-01 03:01:00').toISOString()}`);
    url.searchParams.set("refresh", "true")
    expect(fetch).toHaveBeenCalledWith(
        url.href, expect.objectContaining({
            headers: {
                authorization: `Bearer apiKey`
            }
        })
    );
}

test("runEveryMinute should NOT call webhook with status resolved info when previous state was valid", async () => {
    // arrange
    setMeta("valid")

    fetch.mockResponses(
        [
            JSON.stringify({ results: [1] }), { status: 200 }
        ],
        [
            JSON.stringify({}), { status: 200 }
        ]
    )

    jest.useFakeTimers()
        .setSystemTime(new Date('2020-01-01 03:31:00'));

    // act 
    await runEveryMinute(getMeta());

    // assert
    assertEventsApiCalled();

    expect(fetch).not.toHaveBeenCalledWith(
        "https://webhook.url"
    );
});

test("runEveryMinute should NOT call webhook with error detected info when previous state was invalid", async () => {
    // arrange
    setMeta("invalid")

    fetch.mockResponses(
        [
            JSON.stringify({ results: [] }), { status: 200 }
        ],
        [
            JSON.stringify({}), { status: 200 }
        ]
    )

    jest.useFakeTimers()
        .setSystemTime(new Date('2020-01-01 03:31:00'));

    // act 
    await runEveryMinute(getMeta());

    // assert
    assertEventsApiCalled();

    expect(fetch).not.toHaveBeenCalledWith(
        "https://webhook.url"
    );
});

test("runEveryMinute should call webhook with error detected info when previous state was valid", async () => {
    // arrange
    setMeta("valid")

    fetch.mockResponses(
        [
            JSON.stringify({ results: [] }), { status: 200 }
        ],
        [
            JSON.stringify({}), { status: 200 }
        ]
    )

    jest.useFakeTimers()
        .setSystemTime(new Date('2020-01-01 03:31:00'));

    // act 
    await runEveryMinute(getMeta());

    // assert
    assertEventsApiCalled();

    expect(fetch).toHaveBeenCalledWith(
        "https://webhook.url", expect.objectContaining({
            method: "post",
            headers: {
                "content-type": "application/vnd.microsoft.teams.card.o365connector"
            },
            body: expect.stringContaining('Ingestion error detected'),
        })
    );
});

test("runEveryMinute should call webhook with status resolved info when previous state was invalid", async () => {
    // arrange
    setMeta("invalid")

    fetch.mockResponses(
        [
            JSON.stringify({ results: [1] }), { status: 200 }
        ],
        [
            JSON.stringify({}), { status: 200 }
        ]
    )

    jest.useFakeTimers()
        .setSystemTime(new Date('2020-01-01 03:31:00'));

    // act 
    await runEveryMinute(getMeta());

    // assert
    assertEventsApiCalled();

    expect(fetch).toHaveBeenCalledWith(
        "https://webhook.url", expect.objectContaining({
            method: "post",
            headers: {
                "content-type": "application/vnd.microsoft.teams.card.o365connector"
            },
            body: expect.stringContaining('Ingestion error resolved'),
        })
    );
});
