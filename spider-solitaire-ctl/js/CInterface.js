function CInterface(){
   
    var _aSuitPos;
    
    var _oAudioToggle;
    var _oButExit;
    var _oButHelp;
    var _oButShuffle;
    var _oHelpPanel=null;
    var _oMoveText;
    var _oMoveDisplay;
    var _oMoveNum;
    var _oScoreDisplay;
    var _oScoreText;
    var _oScoreNum;
    var _oHintText;
    var _oHintPanel;
    var _oHintCointainer;
    var _oButFullscreen;
    var _oAreYouSurePanel;
    var _fRequestFullScreen = null;
    var _fCancelFullScreen = null;
    
    var _pStartPosExit;
    var _pStartPosAudio;
    var _pStartPosHelp;
    var _pStartPosShuffle;
    var _pStartPosFullscreen;
    
    this._init = function(){                
        var oExitX;
        
        var oSprite = s_oSpriteLibrary.getSprite('but_exit');
        _pStartPosExit = {x: CANVAS_WIDTH - (oSprite.height/2)- 10, y: (oSprite.height/2) + 10};
        _oButExit = new CGfxButton(_pStartPosExit.x,_pStartPosExit.y,oSprite,s_oStage);
        _oButExit.addEventListener(ON_MOUSE_UP, this._onExit, this);
        
        oExitX = CANVAS_WIDTH - (oSprite.width/2) - 80;
        
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            var oSprite = s_oSpriteLibrary.getSprite('audio_icon');
            _pStartPosAudio = {x: oExitX, y: (oSprite.height/2) + 10};
            _oAudioToggle = new CToggle(_pStartPosAudio.x,_pStartPosAudio.y,oSprite,s_bAudioActive,s_oStage);
            _oAudioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);          
        }

        oExitX = oExitX-68;
        
        var oSprite = s_oSpriteLibrary.getSprite('but_help');
        _pStartPosHelp = {x: oExitX, y: (oSprite.height/2) + 10};
        _oButHelp = new CGfxButton(_pStartPosHelp.x,_pStartPosHelp.y,oSprite,s_oStage);
        _oButHelp.addEventListener(ON_MOUSE_UP, this._onButHelpRelease, this);
        _oButHelp.setVisible(false);
        
        oExitX = oExitX-68;
        
        var oSprite = s_oSpriteLibrary.getSprite('but_shuffle');
        _pStartPosShuffle = {x: oExitX, y: (oSprite.height/2) + 10};
        _oButShuffle = new CGfxButton(_pStartPosShuffle.x,_pStartPosShuffle.y,oSprite,s_oStage);
        _oButShuffle.addEventListener(ON_MOUSE_UP, this._onButRestartRelease, this);
        
        var doc = window.document;
        var docEl = doc.documentElement;
        _fRequestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        _fCancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
        
        if(ENABLE_FULLSCREEN === false){
            _fRequestFullScreen = false;
        }
        
        if (_fRequestFullScreen && screenfull.isEnabled){
            oSprite = s_oSpriteLibrary.getSprite('but_fullscreen');
            _pStartPosFullscreen = {x: oSprite.width/4 + 10,y:(oSprite.height/2) + 10};

            _oButFullscreen = new CToggle(_pStartPosFullscreen.x,_pStartPosFullscreen.y,oSprite,s_bFullscreen,s_oStage);
            _oButFullscreen.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);
        }
        
        var oSprite = s_oSpriteLibrary.getSprite('score_moves_display');
        _oMoveDisplay = createBitmap(oSprite);
        _oMoveDisplay.x = 562;
        _oMoveDisplay.y = 79;       
        s_oStage.addChild(_oMoveDisplay);
        
        var iWidth = 46;
        var iHeight = oSprite.height/2;
        var iX = _oMoveDisplay.x+32;
        var iY = _oMoveDisplay.y+22;
        _oMoveNum = new CTLText(s_oStage, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    25, "right", "#fff", PRIMARY_FONT, 1,
                    2, 0,
                    "0",
                    true, true, false,
                    false );
                    
        var iWidth = 100;
        var iHeight = oSprite.height/2;
        var iX = _oMoveDisplay.x-50;
        var iY = _oMoveDisplay.y+22;
        _oMoveText = new CTLText(s_oStage, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    25, "right", "#fff", PRIMARY_FONT, 1,
                    2, 0,
                    TEXT_MOVES,
                    true, true, false,
                    false );

       
        var oSprite = s_oSpriteLibrary.getSprite('score_moves_display');
        _oScoreDisplay = createBitmap(oSprite);
        _oScoreDisplay.scaleX=1.4;
        _oScoreDisplay.x = 352;
        _oScoreDisplay.y = 79;       
        s_oStage.addChild(_oScoreDisplay);
        
        var iWidth = 68;
        var iHeight = oSprite.height/2;
        var iX = _oScoreDisplay.x+44;
        var iY = _oScoreDisplay.y+22;
        _oScoreNum = new CTLText(s_oStage, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    25, "right", "#fff", PRIMARY_FONT, 1,
                    2, 0,
                    "0",
                    true, true, false,
                    false );

       
        var iWidth = 100;
        var iHeight = oSprite.height/2;
        var iX = _oScoreDisplay.x-50;
        var iY = _oScoreDisplay.y+22;
        _oScoreText = new CTLText(s_oStage, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    25, "right", "#fff", PRIMARY_FONT, 1,
                    2, 0,
                    TEXT_SCORE,
                    true, true, false,
                    false );
       
       
        _oHintCointainer = new createjs.Container();
        _oHintCointainer.x = 1102;
        _oHintCointainer.y = 494;
        _oHintCointainer.alpha=0;
        s_oStage.addChild(_oHintCointainer);
       
        var oSprite = s_oSpriteLibrary.getSprite('hintpanel');
        _oHintPanel = createBitmap(oSprite);
        _oHintCointainer.addChild(_oHintPanel);

        var iWidth = oSprite.width-24;
        var iHeight = oSprite.height/2+6;
        var iX = oSprite.width/2-2;
        var iY = oSprite.height/2-4;
        _oHintText = new CTLText(_oHintCointainer, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    12, "center", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    TEXT_HINT2,
                    true, true, true,
                    false );
       
        
        
        _aSuitPos = new Array();        
        _aSuitPos[0]={x: 1212 - CARD_WIDTH/2, y:220 - CARD_HEIGHT/2};
        _aSuitPos[1]={x: 1302 - CARD_WIDTH/2, y:220 - CARD_HEIGHT/2};
        _aSuitPos[2]={x: 1212 - CARD_WIDTH/2, y:350 - CARD_HEIGHT/2};
        _aSuitPos[3]={x: 1302 - CARD_WIDTH/2, y:350 - CARD_HEIGHT/2};
        
      
        var oHeartSuit = createBitmap(s_oSpriteLibrary.getSprite('hearts_suit'));
        oHeartSuit.x = _aSuitPos[0].x;
        oHeartSuit.y = _aSuitPos[0].y;
        
        
        var oSpadeSuit = createBitmap(s_oSpriteLibrary.getSprite('spades_suit'));
        oSpadeSuit.x = _aSuitPos[1].x;
        oSpadeSuit.y = _aSuitPos[1].y;
        
        
        var oDiamondSuit = createBitmap(s_oSpriteLibrary.getSprite('diamonds_suit'));
        oDiamondSuit.x = _aSuitPos[2].x;
        oDiamondSuit.y = _aSuitPos[2].y;

        
        var oClubSuit = createBitmap(s_oSpriteLibrary.getSprite('clubs_suit'));
        oClubSuit.x = _aSuitPos[3].x;
        oClubSuit.y = _aSuitPos[3].y;

        var oSuitContainer = s_oGame.getSuitContainer();
        
        switch(s_iMode){
            
            case MODE_EASY:{
                    oSuitContainer.addChild(oSpadeSuit);
                    break;
            }
            
            case MODE_NORMAL:{
                    oSuitContainer.addChild(oSpadeSuit);
                    oSuitContainer.addChild(oHeartSuit);
                    
                    break;
            }
            
            case MODE_HARD:{
                    oSuitContainer.addChild(oSpadeSuit);
                    oSuitContainer.addChild(oHeartSuit);
                    oSuitContainer.addChild(oDiamondSuit);
                    oSuitContainer.addChild(oClubSuit);
                    
                    break;
            }
        }
        
        _oAreYouSurePanel = new CAreYouSurePanel(s_oStage);
        _oAreYouSurePanel.addEventListener(ON_BUT_YES_DOWN, this._onConfirmExit);
        
        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
        
    };
    
    this.refreshButtonPos = function(iNewX,iNewY){

        _oButExit.setPosition(_pStartPosExit.x - iNewX,_pStartPosExit.y + iNewY);
        _oButHelp.setPosition(_pStartPosHelp.x - iNewX,_pStartPosHelp.y+ iNewY);
        _oButShuffle.setPosition(_pStartPosShuffle.x - iNewX,_pStartPosShuffle.y+ iNewY);        
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.setPosition(_pStartPosAudio.x - iNewX,_pStartPosAudio.y+ iNewY);
        }
        if (_fRequestFullScreen && screenfull.isEnabled){
            _oButFullscreen.setPosition(_pStartPosFullscreen.x + s_iOffsetX,_pStartPosFullscreen.y + s_iOffsetY);
        }
    };
    
    this.unload = function(){
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.unload();
            _oAudioToggle = null;
        }
        
        if (_fRequestFullScreen && screenfull.isEnabled){
            _oButFullscreen.unload();
        }
        
        _oButExit.unload();
        _oButHelp.unload();
        _oButShuffle.unload();
        if(_oHelpPanel!==null){
            _oHelpPanel.unload();
        }
        
        _oAreYouSurePanel = null;
        s_oInterface = null;
    };

    this.refreshScore = function(iValue){
        _oScoreNum.getText().alpha=1;
        _oScoreNum.refreshText( iValue );
    };

    this.fadeScore = function(iValue, iTime){
        var oParent=this;
        createjs.Tween.get(_oScoreNum.getText()).to({alpha:0}, iTime, createjs.Ease.linear).call(function(){oParent.refreshScore(iValue); });
    };

    this._refreshMove = function(iValue){
        _oMoveNum.getText().alpha=1;
        _oMoveNum.refreshText( iValue );
    };

    this.fadeMove = function(iValue, iTime){
        var oParent=this;
        createjs.Tween.get(_oMoveNum.getText()).to({alpha:0}, iTime, createjs.Ease.linear).call(function(){oParent._refreshMove(iValue); });
    };

    this.showHint = function(szType){
        
        if(szType === "deck"){
			_oHintText.y = 16;
            _oHintText.refreshText( TEXT_HINT1 );
            createjs.Tween.get(_oHintCointainer, {override:true}).to({alpha:1}, 3000, createjs.Ease.linear).call(function(){
															createjs.Tween.get(_oHintCointainer).to({alpha:0}, 3000, createjs.Ease.linear)
														});
        } else {
            _oHintText.y = 22;
            _oHintText.refreshText( TEXT_HINT2 );
            createjs.Tween.get(_oHintCointainer, {override:true}).to({alpha:1}, 3000, createjs.Ease.linear);
        }
   
    };

    this.setVisibleButHelp = function(){
        _oButHelp.setVisible(true);
    };

    this._onButHelpRelease = function(){
        _oHelpPanel = new CHelpPanel();
    };
    
    this._onButRestartRelease = function(){
        s_oGame.restartGame();
        
        $(s_oMain).trigger("restart_level", 1);
        $(s_oMain).trigger("show_interlevel_ad");
    };
    
    this.onExitFromHelp = function(){
        _oHelpPanel.unload();
    };
    
    this._onAudioToggle = function(){
        Howler.mute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };
    
    this._onExit = function(){
        _oAreYouSurePanel.show();
    };
    
    this._onConfirmExit = function(){
        s_oGame.onExit();
        $(s_oMain).trigger("end_level", 1);
        $(s_oMain).trigger("end_session");
        $(s_oMain).trigger("show_interlevel_ad");
    };
    
    this.resetFullscreenBut = function(){
	if (_fRequestFullScreen && screenfull.isEnabled){
		_oButFullscreen.setActive(s_bFullscreen);
	}
    };
    
    this._onFullscreenRelease = function(){
        if(s_bFullscreen) { 
		_fCancelFullScreen.call(window.document);
	}else{
		_fRequestFullScreen.call(window.document.documentElement);
	}
	
	sizeHandler();

    };
    
    s_oInterface = this;
    this._init();
    
    return this;
}


var s_oInterface = null;