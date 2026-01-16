import * as dashjs from 'dashjs';

// LowestBitrateRule - Always selects the lowest bitrate representation
function LowestBitrateRule() {
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

        // Always select the lowest bitrate (index 0)
        if (representations && representations.length > 0) {
            switchRequest.representation = representations[0];
            switchRequest.reason = 'lowest bitrate rule';
        }

        return switchRequest;
    }

    instance = {
        getSwitchRequest: getSwitchRequest
    };

    return instance;
}

LowestBitrateRule.__dashjs_factory_name = 'LowestBitrateRule';
LowestBitrateRule = dashjs.FactoryMaker.getClassFactory(LowestBitrateRule);
