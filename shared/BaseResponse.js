class BaseResponse {
    constructor(response,isSuccesful,message) {
        this.response = response;
        this.IsSuccessful = isSuccesful;
        this.message = message
    }
}

module.exports = BaseResponse