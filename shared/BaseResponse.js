class BaseResponse {
    constructor(response,isSuccesful,message) {
        this.response = response;
        this.isSuccesful = isSuccesful;
        this.message = message
    }
}

module.exports = BaseResponse