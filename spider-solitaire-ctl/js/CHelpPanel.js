function CHelpPanel(){   
    var _oHelpBg;
    var _oHelpBgPage2;
    var _oArrow;
    var _oArrowPage2;
    var _oGroup;
    var _oGroupPage2;
    var _oParent;
    var _oListener;
    var _oListener2;

    this._init = function(){
        s_oGame.pauseGame(true);
        
        var oParent = this;
        
        _oGroup = new createjs.Container();
        _oGroup.alpha=0;
        s_oStage.addChild(_oGroup);
        
        _oHelpBg = createBitmap(s_oSpriteLibrary.getSprite('bg_help'));
        _oGroup.addChild(_oHelpBg);
        
  
        var oText1Pos = {x: CANVAS_WIDTH/2, y: (CANVAS_HEIGHT/2)-170};
        
        var iWidth = 400;
        var iHeight = 60;
        var iX = oText1Pos.x;
        var iY = oText1Pos.y;
        var oText1 = new CTLText(_oGroup, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    20, "center", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    TEXT_HELP1,
                    true, true, true,
                    false );
        oText1.setShadow("#000000", 2, 2, 3);
        
        
        
        var oText2Pos = {x: CANVAS_WIDTH/2 -180, y: (CANVAS_HEIGHT/2)};
        
        var iWidth = 300;
        var iHeight = 90;
        var iX = oText2Pos.x;
        var iY = oText2Pos.y;
        var oText2 = new CTLText(_oGroup, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    20, "center", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    TEXT_HELP2,
                    true, true, true,
                    false );
        oText2.setShadow("#000000", 2, 2, 3);
        
        
        
        var oText3Pos = {x: CANVAS_WIDTH/2, y: (CANVAS_HEIGHT/2) +140};
        
        var iWidth = 500;
        var iHeight = 90;
        var iX = oText3Pos.x;
        var iY = oText3Pos.y;
        var oText3 = new CTLText(_oGroup, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    20, "center", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    TEXT_HELP3,
                    true, true, true,
                    false );
        oText3.setShadow("#000000", 2, 2, 3);
        
        

        createjs.Tween.get(_oGroup).to({alpha:1}, 700).call(function(){s_oGame.pauseGame()});        
        
        _oListener = _oGroup.on("pressup",function(){oParent._onExitHelp()});
        
        _oGroupPage2 = new createjs.Container();
        _oGroupPage2.visible=0;
        s_oStage.addChild(_oGroupPage2);
        
        _oHelpBgPage2 = createBitmap(s_oSpriteLibrary.getSprite('msg_box'));
        _oGroupPage2.addChild(_oHelpBgPage2);
  
        var iWidth = 400;
        var iHeight = 50;
        var iX = CANVAS_WIDTH/2;
        var iY = (CANVAS_HEIGHT/2)-190;
        var oText1Page2 = new CTLText(_oGroupPage2, 
                    iX-iWidth/2, iY-iHeight/2, iWidth, iHeight, 
                    40, "center", "#fff", PRIMARY_FONT, 1,
                    2, 2,
                    TEXT_HELP1_PAGE2,
                    true, true, false,
                    false );
        oText1Page2.setShadow("#000000", 2, 2, 3);


        var iWidth = 600;
        var iHeight = 80;
        var iX = CANVAS_WIDTH/2-328;
        var iY = (CANVAS_HEIGHT/2)-50;
        var oText2Page2 = new CTLText(_oGroupPage2, 
                    iX, iY-iHeight/2, iWidth, iHeight, 
                    28, "left", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    sprintf(TEXT_HELP2_PAGE2, POINTS_TO_WIN),
                    true, true, true,
                    false );
        oText2Page2.setShadow("#000000", 2, 2, 3);

        
        var iWidth = 600;
        var iHeight = 80;
        var iX = CANVAS_WIDTH/2-328;
        var iY = (CANVAS_HEIGHT/2)+80;
        var oText3Page2 = new CTLText(_oGroupPage2, 
                    iX, iY-iHeight/2, iWidth, iHeight, 
                    28, "left", "#fff", PRIMARY_FONT, 1.2,
                    2, 2,
                    sprintf(TEXT_LOSE1_PAGE2, POINTS_TO_LOSE),
                    true, true, true,
                    false );
        oText3Page2.setShadow("#000000", 2, 2, 3);
       

        
        _oListener2 = _oGroupPage2.on("pressup",function(){oParent._onExitHelp()});

        createjs.Tween.get(_oGroupPage2).to({alpha:1}, 700);
        
        
        _oArrow = createBitmap(s_oSpriteLibrary.getSprite('arrow'));
        _oArrow.x = 1202;
        _oArrow.y = 564 ;
        _oArrow.alpha=0;
        _oArrow.on("click", oParent._changePageTo2);
        s_oStage.addChild(_oArrow);
        
        _oArrowPage2 = createBitmap(s_oSpriteLibrary.getSprite('arrow'));
        _oArrowPage2.scaleX = -1;
        _oArrowPage2.x = 392;
        _oArrowPage2.y = 564;
        _oArrowPage2.visible=false;
        _oArrowPage2.on("click", oParent._changePageTo1);
        s_oStage.addChild(_oArrowPage2);
        
        createjs.Tween.get(_oArrow).to({alpha:1}, 700);
        
    };

    this.unload = function(){
        s_oStage.removeChild(_oGroup, _oGroupPage2, _oArrow, _oArrowPage2);

        _oGroup.off("pressup",_oListener);
        _oGroupPage2.off("pressup",_oListener2);
    };

    this._changePageTo1 = function(){ 
        _oGroupPage2.visible=false;
        _oArrowPage2.visible=false;

        _oGroup.visible=true;
        _oArrow.visible=true;

    };

    this._changePageTo2 = function(){        
        _oGroup.visible=false;
        _oArrow.visible=false;

        _oGroupPage2.visible=true;
        _oArrowPage2.visible=true;
        
    };

    this._onExitHelp = function(){
        _oParent.unload();
        $(s_oMain).trigger("show_interlevel_ad");
        s_oGame._onExitHelp();
    };

    _oParent=this;
    this._init();

}
