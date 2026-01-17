var HighestBitrateRule;

// Always selects the highest bitrate representation
function HighestBitrateRule() {
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let context = this.context;
    let instance;

    function getSwitchRequest(ruleCtx) {
        const mediaInfo = ruleCtx.getMediaInfo();
        
        // Only apply to video streams
        if (mediaInfo.type !== 'video') {
            return SwitchRequest(context).create();
        }

        const abrController = ruleCtx.getAbrController();
        const representations = abrController.getPossibleVoRepresentations(mediaInfo);
        const switchRequest = SwitchRequest(context).create();

        // Always select the highest bitrate (last index)
        if (representations && representations.length > 0) {
            const highestIndex = representations.length - 1;
            switchRequest.representation = representations[highestIndex];
            switchRequest.reason = 'highest bitrate rule';
        }

        return switchRequest;
    }

    instance = {
        getSwitchRequest: getSwitchRequest
    };

    return instance;
}

HighestBitrateRule.__dashjs_factory_name = 'HighestBitrateRule';
HighestBitrateRule = dashjs.FactoryMaker.getClassFactory(HighestBitrateRule);
