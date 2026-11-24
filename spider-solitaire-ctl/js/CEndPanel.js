function CEndPanel(oSpriteBg){
    
    var _oBg;
    var _oGroup;
    
    var _oMsgTextBack;
    var _oMsgText;
    var _oExplBack;
    var _oExpl;
    var _oListener;
    
    this._init = function(oSpriteBg){
        
        _oGroup = new createjs.Container();
        _oGroup.alpha = 0;
        _oGroup.visible=false;
        
        
        _oBg = createBitmap(oSpriteBg);
        _oGroup.addChild(_oBg);
        
	_oMsgTextBack = new createjs.Text("","60px "+PRIMARY_FONT, "#000");
        _oMsgTextBack.x = CANVAS_WIDTH/2 +1;
        _oMsgTextBack.y = (CANVAS_HEIGHT/2)-160;
        _oMsgTextBack.textAlign = "center";
        _oGroup.addChild(_oMsgTextBack);

        _oMsgText = new createjs.Text("","60px "+PRIMARY_FONT, "#ffffff");
        _oMsgText.x = CANVAS_WIDTH/2;
        _oMsgText.y = (CANVAS_HEIGHT/2)-162;
        _oMsgText.textAlign = "center";
        _oGroup.addChild(_oMsgText);
        
        
        var iWidth = 650;
        var iHeight = 150;
        var iX = CANVAS_WIDTH/2;
        var iY = (CANVAS_HEIGHT/2) + 50;
        /*
        _oExplBack = new CTLText(_oGroup, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    38, "center", "#000", PRIMARY_FONT, 1,
                    2, 2,
                    " ",
                    true, true, true,
                    false );
        */
        
        _oExpl = new CTLText(_oGroup, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    38, "center", "#fff", PRIMARY_FONT, 1,
                    2, 2,
                    " ",
                    true, true, true,
                    false );
        _oExpl.setShadow("#000",1,1,1);
        
        //setShadow : function(szColor,iOffsetX,iOffsetY,iBlur){
        
        /*
        _oExplBack = new createjs.Text("","38px "+PRIMARY_FONT, "#000");
        _oExplBack.x = CANVAS_WIDTH/2 +1;
        _oExplBack.y = (CANVAS_HEIGHT/2) + 50;
        _oExplBack.textAlign = "center";
        _oExplBack.lineWidth = iLineWidth;
        
        _oExpl = new createjs.Text("","38px "+PRIMARY_FONT, "#ffffff");
        _oExpl.x = CANVAS_WIDTH/2;
        _oExpl.y = (CANVAS_HEIGHT/2) + 52;
        _oExpl.textAlign = "center";
        _oExpl.lineWidth = iLineWidth;
        */
       

        
        //_oGroup.addChild(_oBg, _oExplBack,_oExpl,_oMsgTextBack,_oMsgText);

        s_oStage.addChild(_oGroup);
    };
    
    this.unload = function(){
        _oGroup.off("mousedown",_oListener);
    };
    
    this._initListener = function(){
        _oListener = _oGroup.on("mousedown",this._onExit);
    };
    
    this.show = function(iScore){
        playSound("game_over",1,false);
        
        _oMsgTextBack.text = TEXT_WIN;
        _oMsgText.text = TEXT_WIN;
        
        //_oExplBack.refreshText( TEXT_SCORE +": "+iScore );
        _oExpl.refreshText( TEXT_SCORE +": "+iScore );
        
        _oGroup.visible = true;
        
        var oParent = this;
        createjs.Tween.get(_oGroup).to({alpha:1 }, 500).call(function() {oParent._initListener();});
        
        $(s_oMain).trigger("save_score",[iScore, s_iMode]);        
        $(s_oMain).trigger("end_level",1);
      
        $(s_oMain).trigger("share_event",[iScore]);
    };
    
    this.changeTitle = function(szMsg){
        _oMsgTextBack.text = szMsg;
        _oMsgText.text = szMsg;
    };
    
    this.changeExpl = function(szMsg){
        //_oExplBack.refreshText( szMsg );
        _oExpl.refreshText( szMsg );
    };
    
    this._onExit = function(){
        
        $(s_oMain).trigger("show_interlevel_ad");
		$(s_oMain).trigger("end_session",1);
        
        _oGroup.off("mousedown",_oListener);
        s_oStage.removeChild(_oGroup);
        
        s_oGame.onExit();
    };
    
    this._init(oSpriteBg);
    
    return this;
}
