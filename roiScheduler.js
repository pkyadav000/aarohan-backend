const {
    processDailyROI,
    getToday
} = require("./roiEngine");

let running = false;
let intervalTimer = null;

async function runROI() {

    if (running) {
        console.log(
            "ROI SCHEDULER: previous run still active."
        );
        return;
    }

    running = true;

    try {

        const today = getToday();

        console.log(
            "ROI SCHEDULER CHECK:",
            today
        );

        let result = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                result = await processDailyROI();
                break;
            } catch (error) {

                const retryable =
                    error &&
                    (
                        error.code === 24 ||
                        error.codeName === "LockTimeout" ||
                        (
                            Array.isArray(error.errorLabels) &&
                            error.errorLabels.includes(
                                "TransientTransactionError"
                            )
                        )
                    );

                if (!retryable || attempt === 3) {
                    throw error;
                }

                console.warn(
                    "ROI SCHEDULER: transient MongoDB error. Retrying...",
                    {
                        attempt,
                        nextAttempt: attempt + 1,
                        code: error.code,
                        codeName: error.codeName
                    }
                );

                await new Promise(resolve =>
                    setTimeout(resolve, attempt * 2000)
                );
            }
        }

        console.log(
            "ROI DAILY RUN COMPLETE:",
            JSON.stringify(result)
        );

    } catch (error) {

        console.error(
            "ROI SCHEDULER ERROR:",
            error
        );

    } finally {

        running = false;
    }
}

function startROIScheduler() {

    console.log(
        "ROI SCHEDULER STARTED"
    );

    // Run immediately on server startup.
    // processDailyROI() handles missed dates
    // and prevents duplicate ROI.
    runROI();

    // Re-check every hour.
    // This is intentionally not tied to
    // an exact midnight timer.
    intervalTimer =
        setInterval(
            runROI,
            60 * 60 * 1000
        );
}

module.exports = {
    startROIScheduler,
    runROI
};
