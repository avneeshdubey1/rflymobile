const getBhumeetToken = async() => {
    const token = process.env.BHUMEET_TOKEN;
    if (!token) {
        throw new Error("BHUMEET_TOKEN not found in .env");
    }
    return token;
};
module.exports = getBhumeetToken;