var CustomBitrateRule;

function CustomBitrateRule() {
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let context = this.context; // This is the global dash.js context
    let instance;

    const criticalResevoir = 2;
    const resevoir = 5;
    const cushion = 10;
    let previousIndex; // index of the previous representation
    let isStartUp;
    
    // sliding window of throughput values
    const throughputThreshold = 0.9;

    function initRule() {
        isStartUp = true;
        previousIndex = 0;
    }

    /**
     * Function that gets invoked when the dash.js player
     * wants to check if a quality switch is required.
     * 
     * @param ruleCtx - RulesContext of your ABR algorithm, see writeup
     * for more information/documentation 
     * 
     * @returns SwitchRequest - contains the next representation
     */
    function getSwitchRequest(ruleCtx) {
        console.log('getSwitchRequest');
        const mediaInfo = ruleCtx.getMediaInfo();
        
        // We limit the scope of this project to video streams
        if (mediaInfo.type !== 'video') {
            return SwitchRequest(context).create();
        }

        const abrController = ruleCtx.getAbrController();
        const representations = abrController.getPossibleVoRepresentations(mediaInfo);
        const switchRequest = SwitchRequest(context).create();

        // on startup, switch to the lowest representation
        if (isStartUp) {
            isStartUp = false;
            switchRequest.representation = representations[0];
            switchRequest.reason = 'startup';
            previousIndex = 0;
            // console.log(`[customABR] switched to ${representations[0].bandwidth}bps because ${switchRequest.reason}`);
        } else {
            const { targetIndex, reason } = calculateTargetIndex(representations);
            // console.log(`[customABR] targetIndex: ${targetIndex}, reason: ${reason}`);
    
            if (previousIndex !== targetIndex) { // only switch if the target index is different from the previous index
                switchRequest.representation = representations[targetIndex];
                switchRequest.reason = reason;
                previousIndex = targetIndex;
                console.log(`[customABR] switched to ${representations[targetIndex].bandwidth}bps because ${reason}`);
            }
        }

        return switchRequest;
    }

    /**
     * Function that calculates the target index and reason for the switch request.
     * The logic is based on the buffer level and throughput.
     * If the buffer is too low, use throughput to determine the target index.
     * If the buffer is high, switch to the highest representation.
     * If the buffer is in the middle, switch to the representation with closest bufferthreshold using BBA-0.
     * @param representations - the list of representations
     * @returns { targetIndex, reason } - the target index and reason for the switch request
     */
    function calculateTargetIndex(representations) {
        const buffer = getCurrentBufferLevel(context);
        const throughput = getNetworkThroughput(context);

        let targetIndex = 0; // default to the lowest representation
        let reason = '';
        if (buffer < criticalResevoir) { // buffer is way too low, use lowest representation
            targetIndex = 0;
            reason = 'my buffer is getting empty';
        } else if (buffer >= criticalResevoir && buffer < resevoir) { // buffer is too low, use throughput to determine the target index
            for (let i = 0; i < representations.length; i++) { // find the representation with floor of throughput threshold
                if (representations[i].bandwidth <= throughput * throughputThreshold) {
                    targetIndex = i;
                } else {
                    break;
                }
            }
            reason = 'using throughput, my buffer is too low';
        } else if (buffer >= resevoir + cushion) { // buffer is high, switch to the highest representation
            targetIndex = representations.length - 1;
            reason = 'my buffer is getting full!';
        } else { // buffer is in the middle, switch to the representation with closest bufferthreshold
            const middle = (buffer - resevoir) / cushion;
            const minBandwidth = representations[0].bandwidth;
            const maxBandwidth = representations[representations.length - 1].bandwidth;
            const targetBandwidth = minBandwidth + (maxBandwidth - minBandwidth) * middle;

            for (let i = 0; i < representations.length; i++) { // find the representation with floor of buffer threshold
                if (representations[i].bandwidth <= targetBandwidth) {
                    targetIndex = i;
                } else {
                    break;
                }
            }

            reason = 'using bba, my buffer reached the next threshold!';
        }

        return { targetIndex, reason };
    }

    function getCurrentBufferLevel(context) {
        // Creates factory functions of MetricsModel and DashMetrics
        const MetricsModel = dashjs.FactoryMaker.getSingletonFactoryByName('MetricsModel');
        const DashMetrics = dashjs.FactoryMaker.getSingletonFactoryByName('DashMetrics');

        // Creates instance of metricsModel + dashMetrics using existing context
        const metricsModel = MetricsModel(context).getInstance();
        const dashMetrics = DashMetrics(context).getInstance();
        const metrics = metricsModel.getMetricsFor('video', true);

        var buf = dashMetrics.getCurrentBufferLevel('video', metrics) || -1;
        return buf;
    }

    function getNetworkThroughput(context) {
        const ThroughputController = dashjs.FactoryMaker.getSingletonFactoryByName('ThroughputController');
        const throughputController = ThroughputController(context).getInstance(); 
        const throughput = throughputController.getSafeAverageThroughput('video'); 
        return throughput;
    }

    instance = {
        getSwitchRequest: getSwitchRequest
    };

    initRule();
    return instance;
}

CustomBitrateRule.__dashjs_factory_name = 'CustomBitrateRule';
CustomBitrateRule = dashjs.FactoryMaker.getClassFactory(CustomBitrateRule);