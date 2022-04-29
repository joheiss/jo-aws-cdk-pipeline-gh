const synthetics = require('Synthetics');

const canary = async () => {
    await synthetics.executeHttpStep('Verify API returns 200', process.env.API_ENDPOINT);
};

exports.handler = async () => {
    return await canary();
};
