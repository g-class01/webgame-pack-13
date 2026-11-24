// Copyright (c) 2013-2016 CoolGames

(function() {
/******************************************************************************
 * Spine Runtimes Software License
 * Version 2.3
 * 
 * Copyright (c) 2013-2015, Esoteric Software
 * All rights reserved.
 * 
 * You are granted a perpetual, non-exclusive, non-sublicensable and
 * non-transferable license to use, install, execute and perform the Spine
 * Runtimes Software (the "Software") and derivative works solely for personal
 * or internal use. Without the written permission of Esoteric Software (see
 * Section 2 of the Spine Software License Agreement), you may not (a) modify,
 * translate, adapt or otherwise create derivative works, improvements of the
 * Software or develop new applications using the Software or (b) remove,
 * delete, alter or obscure any trademarks or any copyright, trademark, patent
 * or other intellectual property or proprietary rights notices on or in the
 * Software, including any copy thereof. Redistributions in binary or source
 * form must include this license and terms.
 * 
 * THIS SOFTWARE IS PROVIDED BY ESOTERIC SOFTWARE "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL ESOTERIC SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

var spine = {
	radDeg: 180 / Math.PI,
	degRad: Math.PI / 180,
	temp: [],
    Float32Array: (typeof(Float32Array) === 'undefined') ? Array : Float32Array,
    Uint16Array: (typeof(Uint16Array) === 'undefined') ? Array : Uint16Array
};

spine.BoneData = function (name, parent) {
	this.name = name;
	this.parent = parent;
};
spine.BoneData.prototype = {
	length: 0,
	x: 0, y: 0,
	rotation: 0,
	scaleX: 1, scaleY: 1,
	inheritScale: true,
	inheritRotation: true,
	flipX: false, flipY: false
};

spine.BlendMode = {
	normal: 0,
	additive: 1,
	multiply: 2,
	screen: 3
};

spine.SlotData = function (name, boneData) {
	this.name = name;
	this.boneData = boneData;
};
spine.SlotData.prototype = {
	r: 1, g: 1, b: 1, a: 1,
	attachmentName: null,
	blendMode: spine.BlendMode.normal
};

spine.IkConstraintData = function (name) {
	this.name = name;
	this.bones = [];
};
spine.IkConstraintData.prototype = {
	target: null,
	bendDirection: 1,
	mix: 1
};

spine.Bone = function (boneData, skeleton, parent) {
	this.data = boneData;
	this.skeleton = skeleton;
	this.parent = parent;
	this.setToSetupPose();
};
spine.Bone.yDown = false;
spine.Bone.prototype = {
	x: 0, y: 0,
	rotation: 0, rotationIK: 0,
	scaleX: 1, scaleY: 1,
	flipX: false, flipY: false,
	m00: 0, m01: 0, worldX: 0, // a b x
	m10: 0, m11: 0, worldY: 0, // c d y
	worldRotation: 0,
	worldScaleX: 1, worldScaleY: 1,
	worldFlipX: false, worldFlipY: false,
	updateWorldTransform: function () {
		var parent = this.parent;
		if (parent) {
			this.worldX = this.x * parent.m00 + this.y * parent.m01 + parent.worldX;
			this.worldY = this.x * parent.m10 + this.y * parent.m11 + parent.worldY;
			if (this.data.inheritScale) {
				this.worldScaleX = parent.worldScaleX * this.scaleX;
				this.worldScaleY = parent.worldScaleY * this.scaleY;
			} else {
				this.worldScaleX = this.scaleX;
				this.worldScaleY = this.scaleY;
			}
			this.worldRotation = this.data.inheritRotation ? (parent.worldRotation + this.rotationIK) : this.rotationIK;
			this.worldFlipX = parent.worldFlipX != this.flipX;
			this.worldFlipY = parent.worldFlipY != this.flipY;
		} else {
			var skeletonFlipX = this.skeleton.flipX, skeletonFlipY = this.skeleton.flipY;
			this.worldX = skeletonFlipX ? -this.x : this.x;
			this.worldY = (skeletonFlipY != spine.Bone.yDown) ? -this.y : this.y;
			this.worldScaleX = this.scaleX;
			this.worldScaleY = this.scaleY;
			this.worldRotation = this.rotationIK;
			this.worldFlipX = skeletonFlipX != this.flipX;
			this.worldFlipY = skeletonFlipY != this.flipY;
		}
		var radians = this.worldRotation * spine.degRad;
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		if (this.worldFlipX) {
			this.m00 = -cos * this.worldScaleX;
			this.m01 = sin * this.worldScaleY;
		} else {
			this.m00 = cos * this.worldScaleX;
			this.m01 = -sin * this.worldScaleY;
		}
		if (this.worldFlipY != spine.Bone.yDown) {
			this.m10 = -sin * this.worldScaleX;
			this.m11 = -cos * this.worldScaleY;
		} else {
			this.m10 = sin * this.worldScaleX;
			this.m11 = cos * this.worldScaleY;
		}
	},
	setToSetupPose: function () {
		var data = this.data;
		this.x = data.x;
		this.y = data.y;
		this.rotation = data.rotation;
		this.rotationIK = this.rotation;
		this.scaleX = data.scaleX;
		this.scaleY = data.scaleY;
		this.flipX = data.flipX;
		this.flipY = data.flipY;
	},
	worldToLocal: function (world) {
		var dx = world[0] - this.worldX, dy = world[1] - this.worldY;
		var m00 = this.m00, m10 = this.m10, m01 = this.m01, m11 = this.m11;
		if (this.worldFlipX != (this.worldFlipY != spine.Bone.yDown)) {
			m00 = -m00;
			m11 = -m11;
		}
		var invDet = 1 / (m00 * m11 - m01 * m10);
		world[0] = dx * m00 * invDet - dy * m01 * invDet;
		world[1] = dy * m11 * invDet - dx * m10 * invDet;
	},
	localToWorld: function (local) {
		var localX = local[0], localY = local[1];
		local[0] = localX * this.m00 + localY * this.m01 + this.worldX;
		local[1] = localX * this.m10 + localY * this.m11 + this.worldY;
	}
};

spine.Slot = function (slotData, bone) {
	this.data = slotData;
	this.bone = bone;
	this.setToSetupPose();
};
spine.Slot.prototype = {
	r: 1, g: 1, b: 1, a: 1,
	_attachmentTime: 0,
	attachment: null,
	attachmentVertices: [],
	setAttachment: function (attachment) {
		if (this.attachment == attachment) return;
		this.attachment = attachment;
		this._attachmentTime = this.bone.skeleton.time;
		this.attachmentVertices.length = 0;
	},
	setAttachmentTime: function (time) {
		this._attachmentTime = this.bone.skeleton.time - time;
	},
	getAttachmentTime: function () {
		return this.bone.skeleton.time - this._attachmentTime;
	},
	setToSetupPose: function () {
		var data = this.data;
		this.r = data.r;
		this.g = data.g;
		this.b = data.b;
		this.a = data.a;

		if (!data.attachmentName)
			this.setAttachment(null);
		else {
			var slotDatas = this.bone.skeleton.data.slots;
			for (var i = 0, n = slotDatas.length; i < n; i++) {
				if (slotDatas[i] == data) {
					this.attachment = null;
					this.setAttachment(this.bone.skeleton.getAttachmentBySlotIndex(i, data.attachmentName));
					break;
				}
			}
		}
	}
};

spine.IkConstraint = function (data, skeleton) {
	this.data = data;
	this.mix = data.mix;
	this.bendDirection = data.bendDirection;

	this.bones = [];
	for (var i = 0, n = data.bones.length; i < n; i++)
		this.bones.push(skeleton.findBone(data.bones[i].name));
	this.target = skeleton.findBone(data.target.name);
};
spine.IkConstraint.prototype = {
	apply: function () {
		var target = this.target;
		var bones = this.bones;
		switch (bones.length) {
		case 1:
			spine.IkConstraint.apply1(bones[0], target.worldX, target.worldY, this.mix);
			break;
		case 2:
			spine.IkConstraint.apply2(bones[0], bones[1], target.worldX, target.worldY, this.bendDirection, this.mix);
			break;
		}
	}
};
/** Adjusts the bone rotation so the tip is as close to the target position as possible. The target is specified in the world
 * coordinate system. */
spine.IkConstraint.apply1 = function (bone, targetX, targetY, alpha) {
	var parentRotation = (!bone.data.inheritRotation || !bone.parent) ? 0 : bone.parent.worldRotation;
	var rotation = bone.rotation;
	var rotationIK = Math.atan2(targetY - bone.worldY, targetX - bone.worldX) * spine.radDeg;
	if (bone.worldFlipX != (bone.worldFlipY != spine.Bone.yDown)) rotationIK = -rotationIK;
	rotationIK -= parentRotation;
	bone.rotationIK = rotation + (rotationIK - rotation) * alpha;
};
/** Adjusts the parent and child bone rotations so the tip of the child is as close to the target position as possible. The
 * target is specified in the world coordinate system.
 * @param child Any descendant bone of the parent. */
spine.IkConstraint.apply2 = function (parent, child, targetX, targetY, bendDirection, alpha) {
	var childRotation = child.rotation, parentRotation = parent.rotation;
	if (!alpha) {
		child.rotationIK = childRotation;
		parent.rotationIK = parentRotation;
		return;
	}
	var positionX, positionY, tempPosition = spine.temp;
	var parentParent = parent.parent;
	if (parentParent) {
		tempPosition[0] = targetX;
		tempPosition[1] = targetY;
		parentParent.worldToLocal(tempPosition);
		targetX = (tempPosition[0] - parent.x) * parentParent.worldScaleX;
		targetY = (tempPosition[1] - parent.y) * parentParent.worldScaleY;
	} else {
		targetX -= parent.x;
		targetY -= parent.y;
	}
	if (child.parent == parent) {
		positionX = child.x;
		positionY = child.y;
	} else {
		tempPosition[0] = child.x;
		tempPosition[1] = child.y;
		child.parent.localToWorld(tempPosition);
		parent.worldToLocal(tempPosition);
		positionX = tempPosition[0];
		positionY = tempPosition[1];
	}
	var childX = positionX * parent.worldScaleX, childY = positionY * parent.worldScaleY;
	var offset = Math.atan2(childY, childX);
	var len1 = Math.sqrt(childX * childX + childY * childY), len2 = child.data.length * child.worldScaleX;
	// Based on code by Ryan Juckett with permission: Copyright (c) 2008-2009 Ryan Juckett, http://www.ryanjuckett.com/
	var cosDenom = 2 * len1 * len2;
	if (cosDenom < 0.0001) {
		child.rotationIK = childRotation + (Math.atan2(targetY, targetX) * spine.radDeg - parentRotation - childRotation) * alpha;
		return;
	}
	var cos = (targetX * targetX + targetY * targetY - len1 * len1 - len2 * len2) / cosDenom;
	if (cos < -1)
		cos = -1;
	else if (cos > 1)
		cos = 1;
	var childAngle = Math.acos(cos) * bendDirection;
	var adjacent = len1 + len2 * cos, opposite = len2 * Math.sin(childAngle);
	var parentAngle = Math.atan2(targetY * adjacent - targetX * opposite, targetX * adjacent + targetY * opposite);
	var rotation = (parentAngle - offset) * spine.radDeg - parentRotation;
	if (rotation > 180)
		rotation -= 360;
	else if (rotation < -180) //
		rotation += 360;
	parent.rotationIK = parentRotation + rotation * alpha;
	rotation = (childAngle + offset) * spine.radDeg - childRotation;
	if (rotation > 180)
		rotation -= 360;
	else if (rotation < -180) //
		rotation += 360;
	child.rotationIK = childRotation + (rotation + parent.worldRotation - child.parent.worldRotation) * alpha;
};

spine.Skin = function (name) {
	this.name = name;
	this.attachments = {};
};
spine.Skin.prototype = {
	addAttachment: function (slotIndex, name, attachment) {
		this.attachments[slotIndex + ":" + name] = attachment;
	},
	getAttachment: function (slotIndex, name) {
		return this.attachments[slotIndex + ":" + name];
	},
	_attachAll: function (skeleton, oldSkin) {
		for (var key in oldSkin.attachments) {
			var colon = key.indexOf(":");
			var slotIndex = parseInt(key.substring(0, colon));
			var name = key.substring(colon + 1);
			var slot = skeleton.slots[slotIndex];
			if (slot.attachment && slot.attachment.name == name) {
				var attachment = this.getAttachment(slotIndex, name);
				if (attachment) slot.setAttachment(attachment);
			}
		}
	}
};

spine.Animation = function (name, timelines, duration) {
	this.name = name;
	this.timelines = timelines;
	this.duration = duration;
};
spine.Animation.prototype = {
	apply: function (skeleton, lastTime, time, loop, events) {
		if (loop && this.duration != 0) {
			time %= this.duration;
			lastTime %= this.duration;
		}
		var timelines = this.timelines;
		for (var i = 0, n = timelines.length; i < n; i++)
			timelines[i].apply(skeleton, lastTime, time, events, 1);
	},
	mix: function (skeleton, lastTime, time, loop, events, alpha) {
		if (loop && this.duration != 0) {
			time %= this.duration;
			lastTime %= this.duration;
		}
		var timelines = this.timelines;
		for (var i = 0, n = timelines.length; i < n; i++)
			timelines[i].apply(skeleton, lastTime, time, events, alpha);
	}
};
spine.Animation.binarySearch = function (values, target, step) {
	var low = 0;
	var high = Math.floor(values.length / step) - 2;
	if (!high) return step;
	var current = high >>> 1;
	while (true) {
		if (values[(current + 1) * step] <= target)
			low = current + 1;
		else
			high = current;
		if (low == high) return (low + 1) * step;
		current = (low + high) >>> 1;
	}
};
spine.Animation.binarySearch1 = function (values, target) {
	var low = 0;
	var high = values.length - 2;
	if (!high) return 1;
	var current = high >>> 1;
	while (true) {
		if (values[current + 1] <= target)
			low = current + 1;
		else
			high = current;
		if (low == high) return low + 1;
		current = (low + high) >>> 1;
	}
};
spine.Animation.linearSearch = function (values, target, step) {
	for (var i = 0, last = values.length - step; i <= last; i += step)
		if (values[i] > target) return i;
	return -1;
};

spine.Curves = function (frameCount) {
	this.curves = []; // type, x, y, ...
	//this.curves.length = (frameCount - 1) * 19/*BEZIER_SIZE*/;
};
spine.Curves.prototype = {
	setLinear: function (frameIndex) {
		this.curves[frameIndex * 19/*BEZIER_SIZE*/] = 0/*LINEAR*/;
	},
	setStepped: function (frameIndex) {
		this.curves[frameIndex * 19/*BEZIER_SIZE*/] = 1/*STEPPED*/;
	},
	/** Sets the control handle positions for an interpolation bezier curve used to transition from this keyframe to the next.
	 * cx1 and cx2 are from 0 to 1, representing the percent of time between the two keyframes. cy1 and cy2 are the percent of
	 * the difference between the keyframe's values. */
	setCurve: function (frameIndex, cx1, cy1, cx2, cy2) {
		var subdiv1 = 1 / 10/*BEZIER_SEGMENTS*/, subdiv2 = subdiv1 * subdiv1, subdiv3 = subdiv2 * subdiv1;
		var pre1 = 3 * subdiv1, pre2 = 3 * subdiv2, pre4 = 6 * subdiv2, pre5 = 6 * subdiv3;
		var tmp1x = -cx1 * 2 + cx2, tmp1y = -cy1 * 2 + cy2, tmp2x = (cx1 - cx2) * 3 + 1, tmp2y = (cy1 - cy2) * 3 + 1;
		var dfx = cx1 * pre1 + tmp1x * pre2 + tmp2x * subdiv3, dfy = cy1 * pre1 + tmp1y * pre2 + tmp2y * subdiv3;
		var ddfx = tmp1x * pre4 + tmp2x * pre5, ddfy = tmp1y * pre4 + tmp2y * pre5;
		var dddfx = tmp2x * pre5, dddfy = tmp2y * pre5;

		var i = frameIndex * 19/*BEZIER_SIZE*/;
		var curves = this.curves;
		curves[i++] = 2/*BEZIER*/;
		
		var x = dfx, y = dfy;
		for (var n = i + 19/*BEZIER_SIZE*/ - 1; i < n; i += 2) {
			curves[i] = x;
			curves[i + 1] = y;
			dfx += ddfx;
			dfy += ddfy;
			ddfx += dddfx;
			ddfy += dddfy;
			x += dfx;
			y += dfy;
		}
	},
	getCurvePercent: function (frameIndex, percent) {
		percent = percent < 0 ? 0 : (percent > 1 ? 1 : percent);
		var curves = this.curves;
		var i = frameIndex * 19/*BEZIER_SIZE*/;
		var type = curves[i];
		if (type === 0/*LINEAR*/) return percent;
		if (type == 1/*STEPPED*/) return 0;
		i++;
		var x = 0;
		for (var start = i, n = i + 19/*BEZIER_SIZE*/ - 1; i < n; i += 2) {
			x = curves[i];
			if (x >= percent) {
				var prevX, prevY;
				if (i == start) {
					prevX = 0;
					prevY = 0;
				} else {
					prevX = curves[i - 2];
					prevY = curves[i - 1];
				}
				return prevY + (curves[i + 1] - prevY) * (percent - prevX) / (x - prevX);
			}
		}
		var y = curves[i - 1];
		return y + (1 - y) * (percent - x) / (1 - x); // Last point is 1,1.
	}
};

spine.RotateTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, angle, ...
	this.frames.length = frameCount * 2;
};
spine.RotateTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, angle) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = angle;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 2]) { // Time is after last frame.
			var amount = bone.data.rotation + frames[frames.length - 1] - bone.rotation;
			while (amount > 180)
				amount -= 360;
			while (amount < -180)
				amount += 360;
			bone.rotation += amount * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 2);
		var prevFrameValue = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex - 2/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 2 - 1, percent);

		var amount = frames[frameIndex + 1/*FRAME_VALUE*/] - prevFrameValue;
		while (amount > 180)
			amount -= 360;
		while (amount < -180)
			amount += 360;
		amount = bone.data.rotation + (prevFrameValue + amount * percent) - bone.rotation;
		while (amount > 180)
			amount -= 360;
		while (amount < -180)
			amount += 360;
		bone.rotation += amount * alpha;
	}
};

spine.TranslateTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, x, y, ...
	this.frames.length = frameCount * 3;
};
spine.TranslateTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, x, y) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = x;
		this.frames[frameIndex + 2] = y;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			bone.x += (bone.data.x + frames[frames.length - 2] - bone.x) * alpha;
			bone.y += (bone.data.y + frames[frames.length - 1] - bone.y) * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameX = frames[frameIndex - 2];
		var prevFrameY = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		bone.x += (bone.data.x + prevFrameX + (frames[frameIndex + 1/*FRAME_X*/] - prevFrameX) * percent - bone.x) * alpha;
		bone.y += (bone.data.y + prevFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - prevFrameY) * percent - bone.y) * alpha;
	}
};

spine.ScaleTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, x, y, ...
	this.frames.length = frameCount * 3;
};
spine.ScaleTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, x, y) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = x;
		this.frames[frameIndex + 2] = y;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			bone.scaleX += (bone.data.scaleX * frames[frames.length - 2] - bone.scaleX) * alpha;
			bone.scaleY += (bone.data.scaleY * frames[frames.length - 1] - bone.scaleY) * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameX = frames[frameIndex - 2];
		var prevFrameY = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		bone.scaleX += (bone.data.scaleX * (prevFrameX + (frames[frameIndex + 1/*FRAME_X*/] - prevFrameX) * percent) - bone.scaleX) * alpha;
		bone.scaleY += (bone.data.scaleY * (prevFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - prevFrameY) * percent) - bone.scaleY) * alpha;
	}
};

spine.ColorTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, r, g, b, a, ...
	this.frames.length = frameCount * 5;
};
spine.ColorTimeline.prototype = {
	slotIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 5;
	},
	setFrame: function (frameIndex, time, r, g, b, a) {
		frameIndex *= 5;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = r;
		this.frames[frameIndex + 2] = g;
		this.frames[frameIndex + 3] = b;
		this.frames[frameIndex + 4] = a;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var r, g, b, a;
		if (time >= frames[frames.length - 5]) {
			// Time is after last frame.
			var i = frames.length - 1;
			r = frames[i - 3];
			g = frames[i - 2];
			b = frames[i - 1];
			a = frames[i];
		} else {
			// Interpolate between the previous frame and the current frame.
			var frameIndex = spine.Animation.binarySearch(frames, time, 5);
			var prevFrameR = frames[frameIndex - 4];
			var prevFrameG = frames[frameIndex - 3];
			var prevFrameB = frames[frameIndex - 2];
			var prevFrameA = frames[frameIndex - 1];
			var frameTime = frames[frameIndex];
			var percent = 1 - (time - frameTime) / (frames[frameIndex - 5/*PREV_FRAME_TIME*/] - frameTime);
			percent = this.curves.getCurvePercent(frameIndex / 5 - 1, percent);

			r = prevFrameR + (frames[frameIndex + 1/*FRAME_R*/] - prevFrameR) * percent;
			g = prevFrameG + (frames[frameIndex + 2/*FRAME_G*/] - prevFrameG) * percent;
			b = prevFrameB + (frames[frameIndex + 3/*FRAME_B*/] - prevFrameB) * percent;
			a = prevFrameA + (frames[frameIndex + 4/*FRAME_A*/] - prevFrameA) * percent;
		}
		var slot = skeleton.slots[this.slotIndex];
		if (alpha < 1) {
			slot.r += (r - slot.r) * alpha;
			slot.g += (g - slot.g) * alpha;
			slot.b += (b - slot.b) * alpha;
			slot.a += (a - slot.a) * alpha;
		} else {
			slot.r = r;
			slot.g = g;
			slot.b = b;
			slot.a = a;
		}
	}
};

spine.AttachmentTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.attachmentNames = [];
	this.attachmentNames.length = frameCount;
};
spine.AttachmentTimeline.prototype = {
	slotIndex: 0,
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, attachmentName) {
		this.frames[frameIndex] = time;
		this.attachmentNames[frameIndex] = attachmentName;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;

		var frameIndex = time >= frames[frames.length - 1] ? frames.length - 1 : spine.Animation.binarySearch1(frames, time) - 1;
		if (frames[frameIndex] < lastTime) return;

		var attachmentName = this.attachmentNames[frameIndex];
		skeleton.slots[this.slotIndex].setAttachment(
			!attachmentName ? null : skeleton.getAttachmentBySlotIndex(this.slotIndex, attachmentName));
	}
};

spine.EventTimeline = function (frameCount) {
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.events = [];
	this.events.length = frameCount;
};
spine.EventTimeline.prototype = {
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, event) {
		this.frames[frameIndex] = time;
		this.events[frameIndex] = event;
	},
	/** Fires events for frames > lastTime and <= time. */
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		if (!firedEvents) return;

		var frames = this.frames;
		var frameCount = frames.length;

		if (lastTime > time) { // Fire events after last time for looped animations.
			this.apply(skeleton, lastTime, Number.MAX_VALUE, firedEvents, alpha);
			lastTime = -1;
		} else if (lastTime >= frames[frameCount - 1]) // Last time is after last frame.
			return;
		if (time < frames[0]) return; // Time is before first frame.

		var frameIndex;
		if (lastTime < frames[0])
			frameIndex = 0;
		else {
			frameIndex = spine.Animation.binarySearch1(frames, lastTime);
			var frame = frames[frameIndex];
			while (frameIndex > 0) { // Fire multiple events with the same frame.
				if (frames[frameIndex - 1] != frame) break;
				frameIndex--;
			}
		}
		var events = this.events;
		for (; frameIndex < frameCount && time >= frames[frameIndex]; frameIndex++)
			firedEvents.push(events[frameIndex]);
	}
};

spine.DrawOrderTimeline = function (frameCount) {
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.drawOrders = [];
	this.drawOrders.length = frameCount;
};
spine.DrawOrderTimeline.prototype = {
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, drawOrder) {
		this.frames[frameIndex] = time;
		this.drawOrders[frameIndex] = drawOrder;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var frameIndex;
		if (time >= frames[frames.length - 1]) // Time is after last frame.
			frameIndex = frames.length - 1;
		else
			frameIndex = spine.Animation.binarySearch1(frames, time) - 1;

		var drawOrder = skeleton.drawOrder;
		var slots = skeleton.slots;
		var drawOrderToSetupIndex = this.drawOrders[frameIndex];
		if (!drawOrderToSetupIndex) {
			for (var i = 0, n = slots.length; i < n; i++)
				drawOrder[i] = slots[i];
		} else {
			for (var i = 0, n = drawOrderToSetupIndex.length; i < n; i++)
				drawOrder[i] = skeleton.slots[drawOrderToSetupIndex[i]];
		}

	}
};

spine.FfdTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = [];
	this.frames.length = frameCount;
	this.frameVertices = [];
	this.frameVertices.length = frameCount;
};
spine.FfdTimeline.prototype = {
	slotIndex: 0,
	attachment: 0,
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, vertices) {
		this.frames[frameIndex] = time;
		this.frameVertices[frameIndex] = vertices;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var slot = skeleton.slots[this.slotIndex];
		if (slot.attachment != this.attachment) return;

		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var frameVertices = this.frameVertices;
		var vertexCount = frameVertices[0].length;

		var vertices = slot.attachmentVertices;
		if (vertices.length != vertexCount) alpha = 1;
		vertices.length = vertexCount;

		if (time >= frames[frames.length - 1]) { // Time is after last frame.
			var lastVertices = frameVertices[frames.length - 1];
			if (alpha < 1) {
				for (var i = 0; i < vertexCount; i++)
					vertices[i] += (lastVertices[i] - vertices[i]) * alpha;
			} else {
				for (var i = 0; i < vertexCount; i++)
					vertices[i] = lastVertices[i];
			}
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch1(frames, time);
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex - 1] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex - 1, percent < 0 ? 0 : (percent > 1 ? 1 : percent));

		var prevVertices = frameVertices[frameIndex - 1];
		var nextVertices = frameVertices[frameIndex];

		if (alpha < 1) {
			for (var i = 0; i < vertexCount; i++) {
				var prev = prevVertices[i];
				vertices[i] += (prev + (nextVertices[i] - prev) * percent - vertices[i]) * alpha;
			}
		} else {
			for (var i = 0; i < vertexCount; i++) {
				var prev = prevVertices[i];
				vertices[i] = prev + (nextVertices[i] - prev) * percent;
			}
		}
	}
};

spine.IkConstraintTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, mix, bendDirection, ...
	this.frames.length = frameCount * 3;
};
spine.IkConstraintTimeline.prototype = {
	ikConstraintIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, mix, bendDirection) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = mix;
		this.frames[frameIndex + 2] = bendDirection;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var ikConstraint = skeleton.ikConstraints[this.ikConstraintIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			ikConstraint.mix += (frames[frames.length - 2] - ikConstraint.mix) * alpha;
			ikConstraint.bendDirection = frames[frames.length - 1];
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameMix = frames[frameIndex + -2/*PREV_FRAME_MIX*/];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		var mix = prevFrameMix + (frames[frameIndex + 1/*FRAME_MIX*/] - prevFrameMix) * percent;
		ikConstraint.mix += (mix - ikConstraint.mix) * alpha;
		ikConstraint.bendDirection = frames[frameIndex + -1/*PREV_FRAME_BEND_DIRECTION*/];
	}
};

spine.FlipXTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, flip, ...
	this.frames.length = frameCount * 2;
};
spine.FlipXTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, flip) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = flip ? 1 : 0;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;
		var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
		if (frames[frameIndex] < lastTime) return;
		skeleton.bones[this.boneIndex].flipX = frames[frameIndex + 1] != 0;
	}
};

spine.FlipYTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, flip, ...
	this.frames.length = frameCount * 2;
};
spine.FlipYTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, flip) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = flip ? 1 : 0;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;
		var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
		if (frames[frameIndex] < lastTime) return;
		skeleton.bones[this.boneIndex].flipY = frames[frameIndex + 1] != 0;
	}
};

spine.SkeletonData = function () {
	this.bones = [];
	this.slots = [];
	this.skins = [];
	this.events = [];
	this.animations = [];
	this.ikConstraints = [];
};
spine.SkeletonData.prototype = {
	name: null,
	defaultSkin: null,
	width: 0, height: 0,
	version: null, hash: null,
	/** @return May be null. */
	findBone: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].name == boneName) return bones[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findBoneIndex: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].name == boneName) return i;
		return -1;
	},
	/** @return May be null. */
	findSlot: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++) {
			if (slots[i].name == slotName) return slot[i];
		}
		return null;
	},
	/** @return -1 if the bone was not found. */
	findSlotIndex: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].name == slotName) return i;
		return -1;
	},
	/** @return May be null. */
	findSkin: function (skinName) {
		var skins = this.skins;
		for (var i = 0, n = skins.length; i < n; i++)
			if (skins[i].name == skinName) return skins[i];
		return null;
	},
	/** @return May be null. */
	findEvent: function (eventName) {
		var events = this.events;
		for (var i = 0, n = events.length; i < n; i++)
			if (events[i].name == eventName) return events[i];
		return null;
	},
	/** @return May be null. */
	findAnimation: function (animationName) {
		var animations = this.animations;
		for (var i = 0, n = animations.length; i < n; i++)
			if (animations[i].name == animationName) return animations[i];
		return null;
	},
	/** @return May be null. */
	findIkConstraint: function (ikConstraintName) {
		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++)
			if (ikConstraints[i].name == ikConstraintName) return ikConstraints[i];
		return null;
	}
};

spine.Skeleton = function (skeletonData) {
	this.data = skeletonData;

	this.bones = [];
	for (var i = 0, n = skeletonData.bones.length; i < n; i++) {
		var boneData = skeletonData.bones[i];
		var parent = !boneData.parent ? null : this.bones[skeletonData.bones.indexOf(boneData.parent)];
		this.bones.push(new spine.Bone(boneData, this, parent));
	}

	this.slots = [];
	this.drawOrder = [];
	for (var i = 0, n = skeletonData.slots.length; i < n; i++) {
		var slotData = skeletonData.slots[i];
		var bone = this.bones[skeletonData.bones.indexOf(slotData.boneData)];
		var slot = new spine.Slot(slotData, bone);
		this.slots.push(slot);
		this.drawOrder.push(slot);
	}
	
	this.ikConstraints = [];
	for (var i = 0, n = skeletonData.ikConstraints.length; i < n; i++)
		this.ikConstraints.push(new spine.IkConstraint(skeletonData.ikConstraints[i], this));

	this.boneCache = [];
	this.updateCache();
};
spine.Skeleton.prototype = {
	x: 0, y: 0,
	skin: null,
	r: 1, g: 1, b: 1, a: 1,
	time: 0,
	flipX: false, flipY: false,
	/** Caches information about bones and IK constraints. Must be called if bones or IK constraints are added or removed. */
	updateCache: function () {
		var ikConstraints = this.ikConstraints;
		var ikConstraintsCount = ikConstraints.length;

		var arrayCount = ikConstraintsCount + 1;
		var boneCache = this.boneCache;
		if (boneCache.length > arrayCount) boneCache.length = arrayCount;
		for (var i = 0, n = boneCache.length; i < n; i++)
			boneCache[i].length = 0;
		while (boneCache.length < arrayCount)
			boneCache[boneCache.length] = [];

		var nonIkBones = boneCache[0];
		var bones = this.bones;

		outer:
		for (var i = 0, n = bones.length; i < n; i++) {
			var bone = bones[i];
			var current = bone;
			do {
				for (var ii = 0; ii < ikConstraintsCount; ii++) {
					var ikConstraint = ikConstraints[ii];
					var parent = ikConstraint.bones[0];
					var child= ikConstraint.bones[ikConstraint.bones.length - 1];
					while (true) {
						if (current == child) {
							boneCache[ii].push(bone);
							boneCache[ii + 1].push(bone);
							continue outer;
						}
						if (child == parent) break;
						child = child.parent;
					}
				}
				current = current.parent;
			} while (current);
			nonIkBones[nonIkBones.length] = bone;
		}
	},
	/** Updates the world transform for each bone. */
	updateWorldTransform: function () {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++) {
			var bone = bones[i];
			bone.rotationIK = bone.rotation;
		}
		var i = 0, last = this.boneCache.length - 1;
		while (true) {
			var cacheBones = this.boneCache[i];
			for (var ii = 0, nn = cacheBones.length; ii < nn; ii++)
				cacheBones[ii].updateWorldTransform();
			if (i == last) break;
			this.ikConstraints[i].apply();
			i++;
		}
	},
	/** Sets the bones and slots to their setup pose values. */
	setToSetupPose: function () {
		this.setBonesToSetupPose();
		this.setSlotsToSetupPose();
	},
	setBonesToSetupPose: function () {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			bones[i].setToSetupPose();

		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++) {
			var ikConstraint = ikConstraints[i];
			ikConstraint.bendDirection = ikConstraint.data.bendDirection;
			ikConstraint.mix = ikConstraint.data.mix;
		}
	},
	setSlotsToSetupPose: function () {
		var slots = this.slots;
		var drawOrder = this.drawOrder;
		for (var i = 0, n = slots.length; i < n; i++) {
			drawOrder[i] = slots[i];
			slots[i].setToSetupPose(i);
		}
	},
	/** @return May return null. */
	getRootBone: function () {
		return this.bones.length ? this.bones[0] : null;
	},
	/** @return May be null. */
	findBone: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].data.name == boneName) return bones[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findBoneIndex: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].data.name == boneName) return i;
		return -1;
	},
	/** @return May be null. */
	findSlot: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].data.name == slotName) return slots[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findSlotIndex: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].data.name == slotName) return i;
		return -1;
	},
	setSkinByName: function (skinName) {
		var skin = this.data.findSkin(skinName);
		if (!skin) throw "Skin not found: " + skinName;
		this.setSkin(skin);
	},
	/** Sets the skin used to look up attachments before looking in the {@link SkeletonData#getDefaultSkin() default skin}. 
	 * Attachments from the new skin are attached if the corresponding attachment from the old skin was attached. If there was 
	 * no old skin, each slot's setup mode attachment is attached from the new skin.
	 * @param newSkin May be null. */
	setSkin: function (newSkin) {
		if (newSkin) {
			if (this.skin)
				newSkin._attachAll(this, this.skin);
			else {
				var slots = this.slots;
				for (var i = 0, n = slots.length; i < n; i++) {
					var slot = slots[i];
					var name = slot.data.attachmentName;
					if (name) {
						var attachment = newSkin.getAttachment(i, name);
						if (attachment) slot.setAttachment(attachment);
					}
				}
			}
		}
		this.skin = newSkin;
	},
	/** @return May be null. */
	getAttachmentBySlotName: function (slotName, attachmentName) {
		return this.getAttachmentBySlotIndex(this.data.findSlotIndex(slotName), attachmentName);
	},
	/** @return May be null. */
	getAttachmentBySlotIndex: function (slotIndex, attachmentName) {
		if (this.skin) {
			var attachment = this.skin.getAttachment(slotIndex, attachmentName);
			if (attachment) return attachment;
		}
		if (this.data.defaultSkin) return this.data.defaultSkin.getAttachment(slotIndex, attachmentName);
		return null;
	},
	/** @param attachmentName May be null. */
	setAttachment: function (slotName, attachmentName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++) {
			var slot = slots[i];
			if (slot.data.name == slotName) {
				var attachment = null;
				if (attachmentName) {
					attachment = this.getAttachmentBySlotIndex(i, attachmentName);
					if (!attachment) throw "Attachment not found: " + attachmentName + ", for slot: " + slotName;
				}
				slot.setAttachment(attachment);
				return;
			}
		}
		throw "Slot not found: " + slotName;
	},
	/** @return May be null. */
	findIkConstraint: function (ikConstraintName) {
		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++)
			if (ikConstraints[i].data.name == ikConstraintName) return ikConstraints[i];
		return null;
	},
	update: function (delta) {
		this.time += delta;
	}
};

spine.EventData = function (name) {
	this.name = name;
};
spine.EventData.prototype = {
	intValue: 0,
	floatValue: 0,
	stringValue: null
};

spine.Event = function (data) {
	this.data = data;
};
spine.Event.prototype = {
	intValue: 0,
	floatValue: 0,
	stringValue: null
};

spine.AttachmentType = {
	region: 0,
	boundingbox: 1,
	mesh: 2,
	skinnedmesh: 3
};

spine.RegionAttachment = function (name) {
	this.name = name;
	this.offset = [];
	this.offset.length = 8;
	this.uvs = [];
	this.uvs.length = 8;
};
spine.RegionAttachment.prototype = {
	type: spine.AttachmentType.region,
	x: 0, y: 0,
	rotation: 0,
	scaleX: 1, scaleY: 1,
	width: 0, height: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	setUVs: function (u, v, u2, v2, rotate) {
		var uvs = this.uvs;
		if (rotate) {
			uvs[2/*X2*/] = u;
			uvs[3/*Y2*/] = v2;
			uvs[4/*X3*/] = u;
			uvs[5/*Y3*/] = v;
			uvs[6/*X4*/] = u2;
			uvs[7/*Y4*/] = v;
			uvs[0/*X1*/] = u2;
			uvs[1/*Y1*/] = v2;
		} else {
			uvs[0/*X1*/] = u;
			uvs[1/*Y1*/] = v2;
			uvs[2/*X2*/] = u;
			uvs[3/*Y2*/] = v;
			uvs[4/*X3*/] = u2;
			uvs[5/*Y3*/] = v;
			uvs[6/*X4*/] = u2;
			uvs[7/*Y4*/] = v2;
		}
	},
	updateOffset: function () {
		var regionScaleX = this.width / this.regionOriginalWidth * this.scaleX;
		var regionScaleY = this.height / this.regionOriginalHeight * this.scaleY;
		var localX = -this.width / 2 * this.scaleX + this.regionOffsetX * regionScaleX;
		var localY = -this.height / 2 * this.scaleY + this.regionOffsetY * regionScaleY;
		var localX2 = localX + this.regionWidth * regionScaleX;
		var localY2 = localY + this.regionHeight * regionScaleY;
		var radians = this.rotation * spine.degRad;
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		var localXCos = localX * cos + this.x;
		var localXSin = localX * sin;
		var localYCos = localY * cos + this.y;
		var localYSin = localY * sin;
		var localX2Cos = localX2 * cos + this.x;
		var localX2Sin = localX2 * sin;
		var localY2Cos = localY2 * cos + this.y;
		var localY2Sin = localY2 * sin;
		var offset = this.offset;
		offset[0/*X1*/] = localXCos - localYSin;
		offset[1/*Y1*/] = localYCos + localXSin;
		offset[2/*X2*/] = localXCos - localY2Sin;
		offset[3/*Y2*/] = localY2Cos + localXSin;
		offset[4/*X3*/] = localX2Cos - localY2Sin;
		offset[5/*Y3*/] = localY2Cos + localX2Sin;
		offset[6/*X4*/] = localX2Cos - localYSin;
		offset[7/*Y4*/] = localYCos + localX2Sin;
	},
	computeVertices: function (x, y, bone, vertices) {
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var offset = this.offset;
		vertices[0/*X1*/] = offset[0/*X1*/] * m00 + offset[1/*Y1*/] * m01 + x;
		vertices[1/*Y1*/] = offset[0/*X1*/] * m10 + offset[1/*Y1*/] * m11 + y;
		vertices[2/*X2*/] = offset[2/*X2*/] * m00 + offset[3/*Y2*/] * m01 + x;
		vertices[3/*Y2*/] = offset[2/*X2*/] * m10 + offset[3/*Y2*/] * m11 + y;
		vertices[4/*X3*/] = offset[4/*X3*/] * m00 + offset[5/*X3*/] * m01 + x;
		vertices[5/*X3*/] = offset[4/*X3*/] * m10 + offset[5/*X3*/] * m11 + y;
		vertices[6/*X4*/] = offset[6/*X4*/] * m00 + offset[7/*Y4*/] * m01 + x;
		vertices[7/*Y4*/] = offset[6/*X4*/] * m10 + offset[7/*Y4*/] * m11 + y;
	}
};

spine.MeshAttachment = function (name) {
	this.name = name;
};
spine.MeshAttachment.prototype = {
	type: spine.AttachmentType.mesh,
	vertices: null,
	uvs: null,
	regionUVs: null,
	triangles: null,
	hullLength: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionU: 0, regionV: 0, regionU2: 0, regionV2: 0, regionRotate: false,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	edges: null,
	width: 0, height: 0,
	updateUVs: function () {
		var width = this.regionU2 - this.regionU, height = this.regionV2 - this.regionV;
		var n = this.regionUVs.length;
		if (!this.uvs || this.uvs.length != n) {
            this.uvs = new spine.Float32Array(n);
		}
		if (this.regionRotate) {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height;
			}
		} else {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height;
			}
		}
	},
	computeWorldVertices: function (x, y, slot, worldVertices) {
		var bone = slot.bone;
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var vertices = this.vertices;
		var verticesCount = vertices.length;
		if (slot.attachmentVertices.length == verticesCount) vertices = slot.attachmentVertices;
		for (var i = 0; i < verticesCount; i += 2) {
			var vx = vertices[i];
			var vy = vertices[i + 1];
			worldVertices[i] = vx * m00 + vy * m01 + x;
			worldVertices[i + 1] = vx * m10 + vy * m11 + y;
		}
	}
};

spine.SkinnedMeshAttachment = function (name) {
	this.name = name;
};
spine.SkinnedMeshAttachment.prototype = {
	type: spine.AttachmentType.skinnedmesh,
	bones: null,
	weights: null,
	uvs: null,
	regionUVs: null,
	triangles: null,
	hullLength: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionU: 0, regionV: 0, regionU2: 0, regionV2: 0, regionRotate: false,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	edges: null,
	width: 0, height: 0,
	updateUVs: function (u, v, u2, v2, rotate) {
		var width = this.regionU2 - this.regionU, height = this.regionV2 - this.regionV;
		var n = this.regionUVs.length;
		if (!this.uvs || this.uvs.length != n) {
            this.uvs = new spine.Float32Array(n);
		}
		if (this.regionRotate) {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height;
			}
		} else {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height;
			}
		}
	},
	computeWorldVertices: function (x, y, slot, worldVertices) {
		var skeletonBones = slot.bone.skeleton.bones;
		var weights = this.weights;
		var bones = this.bones;

		var w = 0, v = 0, b = 0, f = 0, n = bones.length, nn;
		var wx, wy, bone, vx, vy, weight;
		if (!slot.attachmentVertices.length) {
			for (; v < n; w += 2) {
				wx = 0;
				wy = 0;
				nn = bones[v++] + v;
				for (; v < nn; v++, b += 3) {
					bone = skeletonBones[bones[v]];
					vx = weights[b];
					vy = weights[b + 1];
					weight = weights[b + 2];
					wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
					wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight;
				}
				worldVertices[w] = wx + x;
				worldVertices[w + 1] = wy + y;
			}
		} else {
			var ffd = slot.attachmentVertices;
			for (; v < n; w += 2) {
				wx = 0;
				wy = 0;
				nn = bones[v++] + v;
				for (; v < nn; v++, b += 3, f += 2) {
					bone = skeletonBones[bones[v]];
					vx = weights[b] + ffd[f];
					vy = weights[b + 1] + ffd[f + 1];
					weight = weights[b + 2];
					wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
					wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight;
				}
				worldVertices[w] = wx + x;
				worldVertices[w + 1] = wy + y;
			}
		}
	}
};

spine.BoundingBoxAttachment = function (name) {
	this.name = name;
	this.vertices = [];
};
spine.BoundingBoxAttachment.prototype = {
	type: spine.AttachmentType.boundingbox,
	computeWorldVertices: function (x, y, bone, worldVertices) {
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var vertices = this.vertices;
		for (var i = 0, n = vertices.length; i < n; i += 2) {
			var px = vertices[i];
			var py = vertices[i + 1];
			worldVertices[i] = px * m00 + py * m01 + x;
			worldVertices[i + 1] = px * m10 + py * m11 + y;
		}
	}
};

spine.AnimationStateData = function (skeletonData) {
	this.skeletonData = skeletonData;
	this.animationToMixTime = {};
};
spine.AnimationStateData.prototype = {
	defaultMix: 0,
	setMixByName: function (fromName, toName, duration) {
		var from = this.skeletonData.findAnimation(fromName);
		if (!from) throw "Animation not found: " + fromName;
		var to = this.skeletonData.findAnimation(toName);
		if (!to) throw "Animation not found: " + toName;
		this.setMix(from, to, duration);
	},
	setMix: function (from, to, duration) {
		this.animationToMixTime[from.name + ":" + to.name] = duration;
	},
	getMix: function (from, to) {
		var key = from.name + ":" + to.name;
		return this.animationToMixTime.hasOwnProperty(key) ? this.animationToMixTime[key] : this.defaultMix;
	}
};

spine.TrackEntry = function () {};
spine.TrackEntry.prototype = {
	next: null, previous: null,
	animation: null,
	loop: false,
	delay: 0, time: 0, lastTime: -1, endTime: 0,
	timeScale: 1,
	mixTime: 0, mixDuration: 0, mix: 1,
	onStart: null, onEnd: null, onComplete: null, onEvent: null
};

spine.AnimationState = function (stateData) {
	this.data = stateData;
	this.tracks = [];
	this.events = [];
};
spine.AnimationState.prototype = {
	onStart: null,
	onEnd: null,
	onComplete: null,
	onEvent: null,
	timeScale: 1,
	update: function (delta) {
		delta *= this.timeScale;
		for (var i = 0; i < this.tracks.length; i++) {
			var current = this.tracks[i];
			if (!current) continue;

			current.time += delta * current.timeScale;
			if (current.previous) {
				var previousDelta = delta * current.previous.timeScale;
				current.previous.time += previousDelta;
				current.mixTime += previousDelta;
			}

			var next = current.next;
			if (next) {
				next.time = current.lastTime - next.delay;
				if (next.time >= 0) this.setCurrent(i, next);
			} else {
				// End non-looping animation when it reaches its end time and there is no next entry.
				if (!current.loop && current.lastTime >= current.endTime) this.clearTrack(i);
			}
		}
	},
	apply: function (skeleton) {
		for (var i = 0; i < this.tracks.length; i++) {
			var current = this.tracks[i];
			if (!current) continue;

			this.events.length = 0;

			var time = current.time;
			var lastTime = current.lastTime;
			var endTime = current.endTime;
			var loop = current.loop;
			if (!loop && time > endTime) time = endTime;

			var previous = current.previous;
			if (!previous) {
				if (current.mix == 1)
					current.animation.apply(skeleton, current.lastTime, time, loop, this.events);
				else
					current.animation.mix(skeleton, current.lastTime, time, loop, this.events, current.mix);
			} else {
				var previousTime = previous.time;
				if (!previous.loop && previousTime > previous.endTime) previousTime = previous.endTime;
				previous.animation.apply(skeleton, previousTime, previousTime, previous.loop, null);

				var alpha = current.mixTime / current.mixDuration * current.mix;
				if (alpha >= 1) {
					alpha = 1;
					current.previous = null;
				}
				current.animation.mix(skeleton, current.lastTime, time, loop, this.events, alpha);
			}

			for (var ii = 0, nn = this.events.length; ii < nn; ii++) {
				var event = this.events[ii];
				if (current.onEvent) current.onEvent(i, event);
				if (this.onEvent) this.onEvent(i, event);
			}

			// Check if completed the animation or a loop iteration.
			if (loop ? (lastTime % endTime > time % endTime) : (lastTime < endTime && time >= endTime)) {
				var count = Math.floor(time / endTime);
				if (current.onComplete) current.onComplete(i, count);
				if (this.onComplete) this.onComplete(i, count);
			}

			current.lastTime = current.time;
		}
	},
	clearTracks: function () {
		for (var i = 0, n = this.tracks.length; i < n; i++)
			this.clearTrack(i);
		this.tracks.length = 0; 
	},
	clearTrack: function (trackIndex) {
		if (trackIndex >= this.tracks.length) return;
		var current = this.tracks[trackIndex];
		if (!current) return;

		if (current.onEnd) current.onEnd(trackIndex);
		if (this.onEnd) this.onEnd(trackIndex);

		this.tracks[trackIndex] = null;
	},
	_expandToIndex: function (index) {
		if (index < this.tracks.length) return this.tracks[index];
		while (index >= this.tracks.length)
			this.tracks.push(null);
		return null;
	},
	setCurrent: function (index, entry) {
		var current = this._expandToIndex(index);
		if (current) {
			var previous = current.previous;
			current.previous = null;

			if (current.onEnd) current.onEnd(index);
			if (this.onEnd) this.onEnd(index);

			entry.mixDuration = this.data.getMix(current.animation, entry.animation);
			if (entry.mixDuration > 0) {
				entry.mixTime = 0;
				// If a mix is in progress, mix from the closest animation.
				if (previous && current.mixTime / current.mixDuration < 0.5)
					entry.previous = previous;
				else
					entry.previous = current;
			}
		}

		this.tracks[index] = entry;

		if (entry.onStart) entry.onStart(index);
		if (this.onStart) this.onStart(index);
	},
	setAnimationByName: function (trackIndex, animationName, loop) {
		var animation = this.data.skeletonData.findAnimation(animationName);
		if (!animation) throw "Animation not found: " + animationName;
		return this.setAnimation(trackIndex, animation, loop);
	},
	/** Set the current animation. Any queued animations are cleared. */
	setAnimation: function (trackIndex, animation, loop) {
		var entry = new spine.TrackEntry();
		entry.animation = animation;
		entry.loop = loop;
		entry.endTime = animation.duration;
		this.setCurrent(trackIndex, entry);
		return entry;
	},
	addAnimationByName: function (trackIndex, animationName, loop, delay) {
		var animation = this.data.skeletonData.findAnimation(animationName);
		if (!animation) throw "Animation not found: " + animationName;
		return this.addAnimation(trackIndex, animation, loop, delay);
	},
	/** Adds an animation to be played delay seconds after the current or last queued animation.
	 * @param delay May be <= 0 to use duration of previous animation minus any mix duration plus the negative delay. */
	addAnimation: function (trackIndex, animation, loop, delay) {
		var entry = new spine.TrackEntry();
		entry.animation = animation;
		entry.loop = loop;
		entry.endTime = animation.duration;

		var last = this._expandToIndex(trackIndex);
		if (last) {
			while (last.next)
				last = last.next;
			last.next = entry;
		} else
			this.tracks[trackIndex] = entry;

		if (delay <= 0) {
			if (last)
				delay += last.endTime - this.data.getMix(last.animation, animation);
			else
				delay = 0;
		}
		entry.delay = delay;

		return entry;
	},
	/** May be null. */
	getCurrent: function (trackIndex) {
		if (trackIndex >= this.tracks.length) return null;
		return this.tracks[trackIndex];
	}
};

spine.SkeletonJson = function (attachmentLoader) {
	this.attachmentLoader = attachmentLoader;
};
spine.SkeletonJson.prototype = {
	scale: 1,
	readSkeletonData: function (root, name) {
		var skeletonData = new spine.SkeletonData();
		skeletonData.name = name;

		// Skeleton.
		var skeletonMap = root["skeleton"];
		if (skeletonMap) {
			skeletonData.hash = skeletonMap["hash"];
			skeletonData.version = skeletonMap["spine"];
			skeletonData.width = skeletonMap["width"] || 0;
			skeletonData.height = skeletonMap["height"] || 0;
		}

		// Bones.
		var bones = root["bones"];
		for (var i = 0, n = bones.length; i < n; i++) {
			var boneMap = bones[i];
			var parent = null;
			if (boneMap["parent"]) {
				parent = skeletonData.findBone(boneMap["parent"]);
				if (!parent) throw "Parent bone not found: " + boneMap["parent"];
			}
			var boneData = new spine.BoneData(boneMap["name"], parent);
			boneData.length = (boneMap["length"] || 0) * this.scale;
			boneData.x = (boneMap["x"] || 0) * this.scale;
			boneData.y = (boneMap["y"] || 0) * this.scale;
			boneData.rotation = (boneMap["rotation"] || 0);
			boneData.scaleX = boneMap.hasOwnProperty("scaleX") ? boneMap["scaleX"] : 1;
			boneData.scaleY = boneMap.hasOwnProperty("scaleY") ? boneMap["scaleY"] : 1;
			boneData.inheritScale = boneMap.hasOwnProperty("inheritScale") ? boneMap["inheritScale"] : true;
			boneData.inheritRotation = boneMap.hasOwnProperty("inheritRotation") ? boneMap["inheritRotation"] : true;
			skeletonData.bones.push(boneData);
		}

		// IK constraints.
		var ik = root["ik"];
		if (ik) {
			for (var i = 0, n = ik.length; i < n; i++) {
				var ikMap = ik[i];
				var ikConstraintData = new spine.IkConstraintData(ikMap["name"]);

				var bones = ikMap["bones"];
				for (var ii = 0, nn = bones.length; ii < nn; ii++) {
					var bone = skeletonData.findBone(bones[ii]);
					if (!bone) throw "IK bone not found: " + bones[ii];
					ikConstraintData.bones.push(bone);
				}

				ikConstraintData.target = skeletonData.findBone(ikMap["target"]);
				if (!ikConstraintData.target) throw "Target bone not found: " + ikMap["target"];

				ikConstraintData.bendDirection = (!ikMap.hasOwnProperty("bendPositive") || ikMap["bendPositive"]) ? 1 : -1;
				ikConstraintData.mix = ikMap.hasOwnProperty("mix") ? ikMap["mix"] : 1;

				skeletonData.ikConstraints.push(ikConstraintData);
			}
		}

		// Slots.
		var slots = root["slots"];
		for (var i = 0, n = slots.length; i < n; i++) {
			var slotMap = slots[i];
			var boneData = skeletonData.findBone(slotMap["bone"]);
			if (!boneData) throw "Slot bone not found: " + slotMap["bone"];
			var slotData = new spine.SlotData(slotMap["name"], boneData);

			var color = slotMap["color"];
			if (color) {
				slotData.r = this.toColor(color, 0);
				slotData.g = this.toColor(color, 1);
				slotData.b = this.toColor(color, 2);
				slotData.a = this.toColor(color, 3);
			}

			slotData.attachmentName = slotMap["attachment"];
			slotData.blendMode = spine.BlendMode[slotMap["blend"] || "normal"];

			skeletonData.slots.push(slotData);
		}

		// Skins.
		var skins = root["skins"];
		for (var skinName in skins) {
			if (!skins.hasOwnProperty(skinName)) continue;
			var skinMap = skins[skinName];
			var skin = new spine.Skin(skinName);
			for (var slotName in skinMap) {
				if (!skinMap.hasOwnProperty(slotName)) continue;
				var slotIndex = skeletonData.findSlotIndex(slotName);
				var slotEntry = skinMap[slotName];
				for (var attachmentName in slotEntry) {
					if (!slotEntry.hasOwnProperty(attachmentName)) continue;
					var attachment = this.readAttachment(skin, attachmentName, slotEntry[attachmentName]);
					if (attachment) skin.addAttachment(slotIndex, attachmentName, attachment);
				}
			}
			skeletonData.skins.push(skin);
			if (skin.name == "default") skeletonData.defaultSkin = skin;
		}

		// Events.
		var events = root["events"];
		for (var eventName in events) {
			if (!events.hasOwnProperty(eventName)) continue;
			var eventMap = events[eventName];
			var eventData = new spine.EventData(eventName);
			eventData.intValue = eventMap["int"] || 0;
			eventData.floatValue = eventMap["float"] || 0;
			eventData.stringValue = eventMap["string"] || null;
			skeletonData.events.push(eventData);
		}

		// Animations.
		var animations = root["animations"];
		for (var animationName in animations) {
			if (!animations.hasOwnProperty(animationName)) continue;
			this.readAnimation(animationName, animations[animationName], skeletonData);
		}

		return skeletonData;
	},
	readAttachment: function (skin, name, map) {
		name = map["name"] || name;

		var type = spine.AttachmentType[map["type"] || "region"];
		var path = map["path"] || name;
		
		var scale = this.scale;
		if (type == spine.AttachmentType.region) {
			var region = this.attachmentLoader.newRegionAttachment(skin, name, path);
			if (!region) return null;
			region.path = path;
			region.x = (map["x"] || 0) * scale;
			region.y = (map["y"] || 0) * scale;
			region.scaleX = map.hasOwnProperty("scaleX") ? map["scaleX"] : 1;
			region.scaleY = map.hasOwnProperty("scaleY") ? map["scaleY"] : 1;
			region.rotation = map["rotation"] || 0;
			region.width = (map["width"] || 0) * scale;
			region.height = (map["height"] || 0) * scale;

			var color = map["color"];
			if (color) {
				region.r = this.toColor(color, 0);
				region.g = this.toColor(color, 1);
				region.b = this.toColor(color, 2);
				region.a = this.toColor(color, 3);
			}

			region.updateOffset();
			return region;
		} else if (type == spine.AttachmentType.mesh) {
			var mesh = this.attachmentLoader.newMeshAttachment(skin, name, path);
			if (!mesh) return null;
			mesh.path = path; 
			mesh.vertices = this.getFloatArray(map, "vertices", scale);
			mesh.triangles = this.getIntArray(map, "triangles");
			mesh.regionUVs = this.getFloatArray(map, "uvs", 1);
			mesh.updateUVs();

			color = map["color"];
			if (color) {
				mesh.r = this.toColor(color, 0);
				mesh.g = this.toColor(color, 1);
				mesh.b = this.toColor(color, 2);
				mesh.a = this.toColor(color, 3);
			}

			mesh.hullLength = (map["hull"] || 0) * 2;
			if (map["edges"]) mesh.edges = this.getIntArray(map, "edges");
			mesh.width = (map["width"] || 0) * scale;
			mesh.height = (map["height"] || 0) * scale;
			return mesh;
		} else if (type == spine.AttachmentType.skinnedmesh) {
			var mesh = this.attachmentLoader.newSkinnedMeshAttachment(skin, name, path);
			if (!mesh) return null;
			mesh.path = path;

			var uvs = this.getFloatArray(map, "uvs", 1);
			var vertices = this.getFloatArray(map, "vertices", 1);
			var weights = [];
			var bones = [];
			for (var i = 0, n = vertices.length; i < n; ) {
				var boneCount = vertices[i++] | 0;
				bones[bones.length] = boneCount;
				for (var nn = i + boneCount * 4; i < nn; ) {
					bones[bones.length] = vertices[i];
					weights[weights.length] = vertices[i + 1] * scale;
					weights[weights.length] = vertices[i + 2] * scale;
					weights[weights.length] = vertices[i + 3];
					i += 4;
				}
			}
			mesh.bones = bones;
			mesh.weights = weights;
			mesh.triangles = this.getIntArray(map, "triangles");
			mesh.regionUVs = uvs;
			mesh.updateUVs();
			
			color = map["color"];
			if (color) {
				mesh.r = this.toColor(color, 0);
				mesh.g = this.toColor(color, 1);
				mesh.b = this.toColor(color, 2);
				mesh.a = this.toColor(color, 3);
			}
			
			mesh.hullLength = (map["hull"] || 0) * 2;
			if (map["edges"]) mesh.edges = this.getIntArray(map, "edges");
			mesh.width = (map["width"] || 0) * scale;
			mesh.height = (map["height"] || 0) * scale;
			return mesh;
		} else if (type == spine.AttachmentType.boundingbox) {
			var attachment = this.attachmentLoader.newBoundingBoxAttachment(skin, name);
			var vertices = map["vertices"];
			for (var i = 0, n = vertices.length; i < n; i++)
				attachment.vertices.push(vertices[i] * scale);
			return attachment;
		}
		throw "Unknown attachment type: " + type;
	},
	readAnimation: function (name, map, skeletonData) {
		var timelines = [];
		var duration = 0;

		var slots = map["slots"];
		for (var slotName in slots) {
			if (!slots.hasOwnProperty(slotName)) continue;
			var slotMap = slots[slotName];
			var slotIndex = skeletonData.findSlotIndex(slotName);

			for (var timelineName in slotMap) {
				if (!slotMap.hasOwnProperty(timelineName)) continue;
				var values = slotMap[timelineName];
				if (timelineName == "color") {
					var timeline = new spine.ColorTimeline(values.length);
					timeline.slotIndex = slotIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var color = valueMap["color"];
						var r = this.toColor(color, 0);
						var g = this.toColor(color, 1);
						var b = this.toColor(color, 2);
						var a = this.toColor(color, 3);
						timeline.setFrame(frameIndex, valueMap["time"], r, g, b, a);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5]);

				} else if (timelineName == "attachment") {
					var timeline = new spine.AttachmentTimeline(values.length);
					timeline.slotIndex = slotIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex++, valueMap["time"], valueMap["name"]);
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);

				} else
					throw "Invalid timeline type for a slot: " + timelineName + " (" + slotName + ")";
			}
		}

		var bones = map["bones"];
		for (var boneName in bones) {
			if (!bones.hasOwnProperty(boneName)) continue;
			var boneIndex = skeletonData.findBoneIndex(boneName);
			if (boneIndex == -1) throw "Bone not found: " + boneName;
			var boneMap = bones[boneName];

			for (var timelineName in boneMap) {
				if (!boneMap.hasOwnProperty(timelineName)) continue;
				var values = boneMap[timelineName];
				if (timelineName == "rotate") {
					var timeline = new spine.RotateTimeline(values.length);
					timeline.boneIndex = boneIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex, valueMap["time"], valueMap["angle"]);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);

				} else if (timelineName == "translate" || timelineName == "scale") {
					var timeline;
					var timelineScale = 1;
					if (timelineName == "scale")
						timeline = new spine.ScaleTimeline(values.length);
					else {
						timeline = new spine.TranslateTimeline(values.length);
						timelineScale = this.scale;
					}
					timeline.boneIndex = boneIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var x = (valueMap["x"] || 0) * timelineScale;
						var y = (valueMap["y"] || 0) * timelineScale;
						timeline.setFrame(frameIndex, valueMap["time"], x, y);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);

				} else if (timelineName == "flipX" || timelineName == "flipY") {
					var x = timelineName == "flipX";
					var timeline = x ? new spine.FlipXTimeline(values.length) : new spine.FlipYTimeline(values.length);
					timeline.boneIndex = boneIndex;

					var field = x ? "x" : "y";
					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex, valueMap["time"], valueMap[field] || false);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);
				} else
					throw "Invalid timeline type for a bone: " + timelineName + " (" + boneName + ")";
			}
		}

		var ikMap = map["ik"];
		for (var ikConstraintName in ikMap) {
			if (!ikMap.hasOwnProperty(ikConstraintName)) continue;
			var ikConstraint = skeletonData.findIkConstraint(ikConstraintName);
			var values = ikMap[ikConstraintName];
			var timeline = new spine.IkConstraintTimeline(values.length);
			timeline.ikConstraintIndex = skeletonData.ikConstraints.indexOf(ikConstraint);
			var frameIndex = 0;
			for (var i = 0, n = values.length; i < n; i++) {
				var valueMap = values[i];
				var mix = valueMap.hasOwnProperty("mix") ? valueMap["mix"] : 1;
				var bendDirection = (!valueMap.hasOwnProperty("bendPositive") || valueMap["bendPositive"]) ? 1 : -1;
				timeline.setFrame(frameIndex, valueMap["time"], mix, bendDirection);
				this.readCurve(timeline, frameIndex, valueMap);
				frameIndex++;
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.frameCount * 3 - 3]);
		}

		var ffd = map["ffd"];
		for (var skinName in ffd) {
			var skin = skeletonData.findSkin(skinName);
			var slotMap = ffd[skinName];
			for (slotName in slotMap) {
				var slotIndex = skeletonData.findSlotIndex(slotName);
				var meshMap = slotMap[slotName];
				for (var meshName in meshMap) {
					var values = meshMap[meshName];
					var timeline = new spine.FfdTimeline(values.length);
					var attachment = skin.getAttachment(slotIndex, meshName);
					if (!attachment) throw "FFD attachment not found: " + meshName;
					timeline.slotIndex = slotIndex;
					timeline.attachment = attachment;
					
					var isMesh = attachment.type == spine.AttachmentType.mesh;
					var vertexCount;
					if (isMesh)
						vertexCount = attachment.vertices.length;
					else
						vertexCount = attachment.weights.length / 3 * 2;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var vertices;
						if (!valueMap["vertices"]) {
							if (isMesh)
								vertices = attachment.vertices;
							else {
								vertices = [];
								vertices.length = vertexCount;
							}
						} else {
							var verticesValue = valueMap["vertices"];
							var vertices = [];
							vertices.length = vertexCount;
							var start = valueMap["offset"] || 0;
							var nn = verticesValue.length;
							if (this.scale == 1) {
								for (var ii = 0; ii < nn; ii++)
									vertices[ii + start] = verticesValue[ii];
							} else {
								for (var ii = 0; ii < nn; ii++)
									vertices[ii + start] = verticesValue[ii] * this.scale;
							}
							if (isMesh) {
								var meshVertices = attachment.vertices;
								for (var ii = 0, nn = vertices.length; ii < nn; ii++)
									vertices[ii] += meshVertices[ii];
							}
						}
						
						timeline.setFrame(frameIndex, valueMap["time"], vertices);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines[timelines.length] = timeline;
					duration = Math.max(duration, timeline.frames[timeline.frameCount - 1]);
				}
			}
		}

		var drawOrderValues = map["drawOrder"];
		if (!drawOrderValues) drawOrderValues = map["draworder"];
		if (drawOrderValues) {
			var timeline = new spine.DrawOrderTimeline(drawOrderValues.length);
			var slotCount = skeletonData.slots.length;
			var frameIndex = 0;
			for (var i = 0, n = drawOrderValues.length; i < n; i++) {
				var drawOrderMap = drawOrderValues[i];
				var drawOrder = null;
				if (drawOrderMap["offsets"]) {
					drawOrder = [];
					drawOrder.length = slotCount;
					for (var ii = slotCount - 1; ii >= 0; ii--)
						drawOrder[ii] = -1;
					var offsets = drawOrderMap["offsets"];
					var unchanged = [];
					unchanged.length = slotCount - offsets.length;
					var originalIndex = 0, unchangedIndex = 0;
					for (var ii = 0, nn = offsets.length; ii < nn; ii++) {
						var offsetMap = offsets[ii];
						var slotIndex = skeletonData.findSlotIndex(offsetMap["slot"]);
						if (slotIndex == -1) throw "Slot not found: " + offsetMap["slot"];
						// Collect unchanged items.
						while (originalIndex != slotIndex)
							unchanged[unchangedIndex++] = originalIndex++;
						// Set changed items.
						drawOrder[originalIndex + offsetMap["offset"]] = originalIndex++;
					}
					// Collect remaining unchanged items.
					while (originalIndex < slotCount)
						unchanged[unchangedIndex++] = originalIndex++;
					// Fill in unchanged items.
					for (var ii = slotCount - 1; ii >= 0; ii--)
						if (drawOrder[ii] == -1) drawOrder[ii] = unchanged[--unchangedIndex];
				}
				timeline.setFrame(frameIndex++, drawOrderMap["time"], drawOrder);
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
		}

		var events = map["events"];
		if (events) {
			var timeline = new spine.EventTimeline(events.length);
			var frameIndex = 0;
			for (var i = 0, n = events.length; i < n; i++) {
				var eventMap = events[i];
				var eventData = skeletonData.findEvent(eventMap["name"]);
				if (!eventData) throw "Event not found: " + eventMap["name"];
				var event = new spine.Event(eventData);
				event.intValue = eventMap.hasOwnProperty("int") ? eventMap["int"] : eventData.intValue;
				event.floatValue = eventMap.hasOwnProperty("float") ? eventMap["float"] : eventData.floatValue;
				event.stringValue = eventMap.hasOwnProperty("string") ? eventMap["string"] : eventData.stringValue;
				timeline.setFrame(frameIndex++, eventMap["time"], event);
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
		}

		skeletonData.animations.push(new spine.Animation(name, timelines, duration));
	},
	readCurve: function (timeline, frameIndex, valueMap) {
		var curve = valueMap["curve"];
		if (!curve) 
			timeline.curves.setLinear(frameIndex);
		else if (curve == "stepped")
			timeline.curves.setStepped(frameIndex);
		else if (curve instanceof Array)
			timeline.curves.setCurve(frameIndex, curve[0], curve[1], curve[2], curve[3]);
	},
	toColor: function (hexString, colorIndex) {
		if (hexString.length != 8) throw "Color hexidecimal length must be 8, recieved: " + hexString;
		return parseInt(hexString.substring(colorIndex * 2, (colorIndex * 2) + 2), 16) / 255;
	},
	getFloatArray: function (map, name, scale) {
		var list = map[name];
		var values = new spine.Float32Array(list.length);
		var i = 0, n = list.length;
		if (scale == 1) {
			for (; i < n; i++)
				values[i] = list[i];
		} else {
			for (; i < n; i++)
				values[i] = list[i] * scale;
		}
		return values;
	},
	getIntArray: function (map, name) {
		var list = map[name];
		var values = new spine.Uint16Array(list.length);
		for (var i = 0, n = list.length; i < n; i++)
			values[i] = list[i] | 0;
		return values;
	}
};

spine.Atlas = function (atlasText, textureLoader) {
	this.textureLoader = textureLoader;
	this.pages = [];
	this.regions = [];

	var reader = new spine.AtlasReader(atlasText);
	var tuple = [];
	tuple.length = 4;
	var page = null;
	while (true) {
		var line = reader.readLine();
		if (line === null) break;
		line = reader.trim(line);
		if (!line.length)
			page = null;
		else if (!page) {
			page = new spine.AtlasPage();
			page.name = line;

			if (reader.readTuple(tuple) == 2) { // size is only optional for an atlas packed with an old TexturePacker.
				page.width = parseInt(tuple[0]);
				page.height = parseInt(tuple[1]);
				reader.readTuple(tuple);
			}
			page.format = spine.Atlas.Format[tuple[0]];

			reader.readTuple(tuple);
			page.minFilter = spine.Atlas.TextureFilter[tuple[0]];
			page.magFilter = spine.Atlas.TextureFilter[tuple[1]];

			var direction = reader.readValue();
			page.uWrap = spine.Atlas.TextureWrap.clampToEdge;
			page.vWrap = spine.Atlas.TextureWrap.clampToEdge;
			if (direction == "x")
				page.uWrap = spine.Atlas.TextureWrap.repeat;
			else if (direction == "y")
				page.vWrap = spine.Atlas.TextureWrap.repeat;
			else if (direction == "xy")
				page.uWrap = page.vWrap = spine.Atlas.TextureWrap.repeat;

			textureLoader.load(page, line, this);

			this.pages.push(page);

		} else {
			var region = new spine.AtlasRegion();
			region.name = line;
			region.page = page;

			region.rotate = reader.readValue() == "true";

			reader.readTuple(tuple);
			var x = parseInt(tuple[0]);
			var y = parseInt(tuple[1]);

			reader.readTuple(tuple);
			var width = parseInt(tuple[0]);
			var height = parseInt(tuple[1]);

			region.u = x / page.width;
			region.v = y / page.height;
			if (region.rotate) {
				region.u2 = (x + height) / page.width;
				region.v2 = (y + width) / page.height;
			} else {
				region.u2 = (x + width) / page.width;
				region.v2 = (y + height) / page.height;
			}
			region.x = x;
			region.y = y;
			region.width = Math.abs(width);
			region.height = Math.abs(height);

			if (reader.readTuple(tuple) == 4) { // split is optional
				region.splits = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];

				if (reader.readTuple(tuple) == 4) { // pad is optional, but only present with splits
					region.pads = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];

					reader.readTuple(tuple);
				}
			}

			region.originalWidth = parseInt(tuple[0]);
			region.originalHeight = parseInt(tuple[1]);

			reader.readTuple(tuple);
			region.offsetX = parseInt(tuple[0]);
			region.offsetY = parseInt(tuple[1]);

			region.index = parseInt(reader.readValue());

			this.regions.push(region);
		}
	}
};
spine.Atlas.prototype = {
	findRegion: function (name) {
		var regions = this.regions;
		for (var i = 0, n = regions.length; i < n; i++)
			if (regions[i].name == name) return regions[i];
		return null;
	},
	dispose: function () {
		var pages = this.pages;
		for (var i = 0, n = pages.length; i < n; i++)
			this.textureLoader.unload(pages[i].rendererObject);
	},
	updateUVs: function (page) {
		var regions = this.regions;
		for (var i = 0, n = regions.length; i < n; i++) {
			var region = regions[i];
			if (region.page != page) continue;
			region.u = region.x / page.width;
			region.v = region.y / page.height;
			if (region.rotate) {
				region.u2 = (region.x + region.height) / page.width;
				region.v2 = (region.y + region.width) / page.height;
			} else {
				region.u2 = (region.x + region.width) / page.width;
				region.v2 = (region.y + region.height) / page.height;
			}
		}
	}
};

spine.Atlas.Format = {
	alpha: 0,
	intensity: 1,
	luminanceAlpha: 2,
	rgb565: 3,
	rgba4444: 4,
	rgb888: 5,
	rgba8888: 6
};

spine.Atlas.TextureFilter = {
	nearest: 0,
	linear: 1,
	mipMap: 2,
	mipMapNearestNearest: 3,
	mipMapLinearNearest: 4,
	mipMapNearestLinear: 5,
	mipMapLinearLinear: 6
};

spine.Atlas.TextureWrap = {
	mirroredRepeat: 0,
	clampToEdge: 1,
	repeat: 2
};

spine.AtlasPage = function () {};
spine.AtlasPage.prototype = {
	name: null,
	format: null,
	minFilter: null,
	magFilter: null,
	uWrap: null,
	vWrap: null,
	rendererObject: null,
	width: 0,
	height: 0
};

spine.AtlasRegion = function () {};
spine.AtlasRegion.prototype = {
	page: null,
	name: null,
	x: 0, y: 0,
	width: 0, height: 0,
	u: 0, v: 0, u2: 0, v2: 0,
	offsetX: 0, offsetY: 0,
	originalWidth: 0, originalHeight: 0,
	index: 0,
	rotate: false,
	splits: null,
	pads: null
};

spine.AtlasReader = function (text) {
	this.lines = text.split(/\r\n|\r|\n/);
};
spine.AtlasReader.prototype = {
	index: 0,
	trim: function (value) {
		return value.replace(/^\s+|\s+$/g, "");
	},
	readLine: function () {
		if (this.index >= this.lines.length) return null;
		return this.lines[this.index++];
	},
	readValue: function () {
		var line = this.readLine();
		var colon = line.indexOf(":");
		if (colon == -1) throw "Invalid line: " + line;
		return this.trim(line.substring(colon + 1));
	},
	/** Returns the number of tuple values read (1, 2 or 4). */
	readTuple: function (tuple) {
		var line = this.readLine();
		var colon = line.indexOf(":");
		if (colon == -1) throw "Invalid line: " + line;
		var i = 0, lastMatch = colon + 1;
		for (; i < 3; i++) {
			var comma = line.indexOf(",", lastMatch);
			if (comma == -1) break;
			tuple[i] = this.trim(line.substr(lastMatch, comma - lastMatch));
			lastMatch = comma + 1;
		}
		tuple[i] = this.trim(line.substring(lastMatch));
		return i + 1;
	}
};

spine.AtlasAttachmentLoader = function (atlas) {
	this.atlas = atlas;
};
spine.AtlasAttachmentLoader.prototype = {
	newRegionAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (region attachment: " + name + ")";
		var attachment = new spine.RegionAttachment(name);
		attachment.rendererObject = region;
		attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newMeshAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (mesh attachment: " + name + ")";
		var attachment = new spine.MeshAttachment(name);
		attachment.rendererObject = region;
		attachment.regionU = region.u;
		attachment.regionV = region.v;
		attachment.regionU2 = region.u2;
		attachment.regionV2 = region.v2;
		attachment.regionRotate = region.rotate;
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newSkinnedMeshAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (skinned mesh attachment: " + name + ")";
		var attachment = new spine.SkinnedMeshAttachment(name);
		attachment.rendererObject = region;
		attachment.regionU = region.u;
		attachment.regionV = region.v;
		attachment.regionU2 = region.u2;
		attachment.regionV2 = region.v2;
		attachment.regionRotate = region.rotate;
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newBoundingBoxAttachment: function (skin, name) {
		return new spine.BoundingBoxAttachment(name);
	}
};

spine.SkeletonBounds = function () {
	this.polygonPool = [];
	this.polygons = [];
	this.boundingBoxes = [];
};
spine.SkeletonBounds.prototype = {
	minX: 0, minY: 0, maxX: 0, maxY: 0,
	update: function (skeleton, updateAabb) {
		var slots = skeleton.slots;
		var slotCount = slots.length;
		var x = skeleton.x, y = skeleton.y;
		var boundingBoxes = this.boundingBoxes;
		var polygonPool = this.polygonPool;
		var polygons = this.polygons;

		boundingBoxes.length = 0;
		for (var i = 0, n = polygons.length; i < n; i++)
			polygonPool.push(polygons[i]);
		polygons.length = 0;

		for (var i = 0; i < slotCount; i++) {
			var slot = slots[i];
			var boundingBox = slot.attachment;
			if (boundingBox.type != spine.AttachmentType.boundingbox) continue;
			boundingBoxes.push(boundingBox);

			var poolCount = polygonPool.length, polygon;
			if (poolCount > 0) {
				polygon = polygonPool[poolCount - 1];
				polygonPool.splice(poolCount - 1, 1);
			} else
				polygon = [];
			polygons.push(polygon);

			polygon.length = boundingBox.vertices.length;
			boundingBox.computeWorldVertices(x, y, slot.bone, polygon);
		}

		if (updateAabb) this.aabbCompute();
	},
	aabbCompute: function () {
		var polygons = this.polygons;
		var minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
		for (var i = 0, n = polygons.length; i < n; i++) {
			var vertices = polygons[i];
			for (var ii = 0, nn = vertices.length; ii < nn; ii += 2) {
				var x = vertices[ii];
				var y = vertices[ii + 1];
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	},
	/** Returns true if the axis aligned bounding box contains the point. */
	aabbContainsPoint: function (x, y) {
		return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
	},
	/** Returns true if the axis aligned bounding box intersects the line segment. */
	aabbIntersectsSegment: function (x1, y1, x2, y2) {
		var minX = this.minX, minY = this.minY, maxX = this.maxX, maxY = this.maxY;
		if ((x1 <= minX && x2 <= minX) || (y1 <= minY && y2 <= minY) || (x1 >= maxX && x2 >= maxX) || (y1 >= maxY && y2 >= maxY))
			return false;
		var m = (y2 - y1) / (x2 - x1);
		var y = m * (minX - x1) + y1;
		if (y > minY && y < maxY) return true;
		y = m * (maxX - x1) + y1;
		if (y > minY && y < maxY) return true;
		var x = (minY - y1) / m + x1;
		if (x > minX && x < maxX) return true;
		x = (maxY - y1) / m + x1;
		if (x > minX && x < maxX) return true;
		return false;
	},
	/** Returns true if the axis aligned bounding box intersects the axis aligned bounding box of the specified bounds. */
	aabbIntersectsSkeleton: function (bounds) {
		return this.minX < bounds.maxX && this.maxX > bounds.minX && this.minY < bounds.maxY && this.maxY > bounds.minY;
	},
	/** Returns the first bounding box attachment that contains the point, or null. When doing many checks, it is usually more
	 * efficient to only call this method if {@link #aabbContainsPoint(float, float)} returns true. */
	containsPoint: function (x, y) {
		var polygons = this.polygons;
		for (var i = 0, n = polygons.length; i < n; i++)
			if (this.polygonContainsPoint(polygons[i], x, y)) return this.boundingBoxes[i];
		return null;
	},
	/** Returns the first bounding box attachment that contains the line segment, or null. When doing many checks, it is usually
	 * more efficient to only call this method if {@link #aabbIntersectsSegment(float, float, float, float)} returns true. */
	intersectsSegment: function (x1, y1, x2, y2) {
		var polygons = this.polygons;
		for (var i = 0, n = polygons.length; i < n; i++)
			if (polygons[i].intersectsSegment(x1, y1, x2, y2)) return this.boundingBoxes[i];
		return null;
	},
	/** Returns true if the polygon contains the point. */
	polygonContainsPoint: function (polygon, x, y) {
		var nn = polygon.length;
		var prevIndex = nn - 2;
		var inside = false;
		for (var ii = 0; ii < nn; ii += 2) {
			var vertexY = polygon[ii + 1];
			var prevY = polygon[prevIndex + 1];
			if ((vertexY < y && prevY >= y) || (prevY < y && vertexY >= y)) {
				var vertexX = polygon[ii];
				if (vertexX + (y - vertexY) / (prevY - vertexY) * (polygon[prevIndex] - vertexX) < x) inside = !inside;
			}
			prevIndex = ii;
		}
		return inside;
	},
	/** Returns true if the polygon contains the line segment. */
	polygonIntersectsSegment: function (polygon, x1, y1, x2, y2) {
		var nn = polygon.length;
		var width12 = x1 - x2, height12 = y1 - y2;
		var det1 = x1 * y2 - y1 * x2;
		var x3 = polygon[nn - 2], y3 = polygon[nn - 1];
		for (var ii = 0; ii < nn; ii += 2) {
			var x4 = polygon[ii], y4 = polygon[ii + 1];
			var det2 = x3 * y4 - y3 * x4;
			var width34 = x3 - x4, height34 = y3 - y4;
			var det3 = width12 * height34 - height12 * width34;
			var x = (det1 * width34 - width12 * det2) / det3;
			if (((x >= x3 && x <= x4) || (x >= x4 && x <= x3)) && ((x >= x1 && x <= x2) || (x >= x2 && x <= x1))) {
				var y = (det1 * height34 - height12 * det2) / det3;
				if (((y >= y3 && y <= y4) || (y >= y4 && y <= y3)) && ((y >= y1 && y <= y2) || (y >= y2 && y <= y1))) return true;
			}
			x3 = x4;
			y3 = y4;
		}
		return false;
	},
	getPolygon: function (attachment) {
		var index = this.boundingBoxes.indexOf(attachment);
		return index == -1 ? null : this.polygons[index];
	},
	getWidth: function () {
		return this.maxX - this.minX;
	},
	getHeight: function () {
		return this.maxY - this.minY;
	}
};
// *********************************
// CoolGames Builder JavaScript file
// *********************************

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
/**
 * CryptoJS core components.
 */
var CryptoJS = CryptoJS || (function (Math, undefined) {
        /**
         * CryptoJS namespace.
         */
        var C = {};

        /**
         * Library namespace.
         */
        var C_lib = C.lib = {};

        /**
         * Base object for prototypal inheritance.
         */
        var Base = C_lib.Base = (function () {
            function F() {}

            return {
                /**
                 * Creates a new object that inherits from this object.
                 *
                 * @param {Object} overrides Properties to copy into the new object.
                 *
                 * @return {Object} The new object.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
                 */
                extend: function (overrides) {
                    // Spawn
                    F.prototype = this;
                    var subtype = new F();

                    // Augment
                    if (overrides) {
                        subtype.mixIn(overrides);
                    }

                    // Create default initializer
                    if (!subtype.hasOwnProperty('init')) {
                        subtype.init = function () {
                            subtype.$super.init.apply(this, arguments);
                        };
                    }

                    // Initializer's prototype is the subtype object
                    subtype.init.prototype = subtype;

                    // Reference supertype
                    subtype.$super = this;

                    return subtype;
                },

                /**
                 * Extends this object and runs the init method.
                 * Arguments to create() will be passed to init().
                 *
                 * @return {Object} The new object.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var instance = MyType.create();
                 */
                create: function () {
                    var instance = this.extend();
                    instance.init.apply(instance, arguments);

                    return instance;
                },

                /**
                 * Initializes a newly created object.
                 * Override this method to add some logic when your objects are created.
                 *
                 * @example
                 *
                 *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
                 */
                init: function () {
                },

                /**
                 * Copies properties into this object.
                 *
                 * @param {Object} properties The properties to mix in.
                 *
                 * @example
                 *
                 *     MyType.mixIn({
             *         field: 'value'
             *     });
                 */
                mixIn: function (properties) {
                    for (var propertyName in properties) {
                        if (properties.hasOwnProperty(propertyName)) {
                            this[propertyName] = properties[propertyName];
                        }
                    }

                    // IE won't copy toString using the loop above
                    if (properties.hasOwnProperty('toString')) {
                        this.toString = properties.toString;
                    }
                },

                /**
                 * Creates a copy of this object.
                 *
                 * @return {Object} The clone.
                 *
                 * @example
                 *
                 *     var clone = instance.clone();
                 */
                clone: function () {
                    return this.init.prototype.extend(this);
                }
            };
        }());

        /**
         * An array of 32-bit words.
         *
         * @property {Array} words The array of 32-bit words.
         * @property {number} sigBytes The number of significant bytes in this word array.
         */
        var WordArray = C_lib.WordArray = Base.extend({
            /**
             * Initializes a newly created word array.
             *
             * @param {Array} words (Optional) An array of 32-bit words.
             * @param {number} sigBytes (Optional) The number of significant bytes in the words.
             *
             * @example
             *
             *     var wordArray = CryptoJS.lib.WordArray.create();
             *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
             *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
             */
            init: function (words, sigBytes) {
                words = this.words = words || [];

                if (sigBytes != undefined) {
                    this.sigBytes = sigBytes;
                } else {
                    this.sigBytes = words.length * 4;
                }
            },

            /**
             * Converts this word array to a string.
             *
             * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
             *
             * @return {string} The stringified word array.
             *
             * @example
             *
             *     var string = wordArray + '';
             *     var string = wordArray.toString();
             *     var string = wordArray.toString(CryptoJS.enc.Utf8);
             */
            toString: function (encoder) {
                return (encoder || Hex).stringify(this);
            },

            /**
             * Concatenates a word array to this word array.
             *
             * @param {WordArray} wordArray The word array to append.
             *
             * @return {WordArray} This word array.
             *
             * @example
             *
             *     wordArray1.concat(wordArray2);
             */
            concat: function (wordArray) {
                // Shortcuts
                var thisWords = this.words;
                var thatWords = wordArray.words;
                var thisSigBytes = this.sigBytes;
                var thatSigBytes = wordArray.sigBytes;

                // Clamp excess bits
                this.clamp();

                // Concat
                if (thisSigBytes % 4) {
                    // Copy one byte at a time
                    for (var i = 0; i < thatSigBytes; i++) {
                        var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                    }
                } else if (thatWords.length > 0xffff) {
                    // Copy one word at a time
                    for (var i = 0; i < thatSigBytes; i += 4) {
                        thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                    }
                } else {
                    // Copy all words at once
                    thisWords.push.apply(thisWords, thatWords);
                }
                this.sigBytes += thatSigBytes;

                // Chainable
                return this;
            },

            /**
             * Removes insignificant bits.
             *
             * @example
             *
             *     wordArray.clamp();
             */
            clamp: function () {
                // Shortcuts
                var words = this.words;
                var sigBytes = this.sigBytes;

                // Clamp
                words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                words.length = Math.ceil(sigBytes / 4);
            },

            /**
             * Creates a copy of this word array.
             *
             * @return {WordArray} The clone.
             *
             * @example
             *
             *     var clone = wordArray.clone();
             */
            clone: function () {
                var clone = Base.clone.call(this);
                clone.words = this.words.slice(0);

                return clone;
            },

            /**
             * Creates a word array filled with random bytes.
             *
             * @param {number} nBytes The number of random bytes to generate.
             *
             * @return {WordArray} The random word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.lib.WordArray.random(16);
             */
            random: function (nBytes) {
                var words = [];
                for (var i = 0; i < nBytes; i += 4) {
                    words.push((Math.random() * 0x100000000) | 0);
                }

                return new WordArray.init(words, nBytes);
            }
        });

        /**
         * Encoder namespace.
         */
        var C_enc = C.enc = {};

        /**
         * Hex encoding strategy.
         */
        var Hex = C_enc.Hex = {
            /**
             * Converts a word array to a hex string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The hex string.
             *
             * @static
             *
             * @example
             *
             *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
             */
            stringify: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                // Convert
                var hexChars = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    hexChars.push((bite >>> 4).toString(16));
                    hexChars.push((bite & 0x0f).toString(16));
                }

                return hexChars.join('');
            },

            /**
             * Converts a hex string to a word array.
             *
             * @param {string} hexStr The hex string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
             */
            parse: function (hexStr) {
                // Shortcut
                var hexStrLength = hexStr.length;

                // Convert
                var words = [];
                for (var i = 0; i < hexStrLength; i += 2) {
                    words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
                }

                return new WordArray.init(words, hexStrLength / 2);
            }
        };

        /**
         * Latin1 encoding strategy.
         */
        var Latin1 = C_enc.Latin1 = {
            /**
             * Converts a word array to a Latin1 string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The Latin1 string.
             *
             * @static
             *
             * @example
             *
             *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
             */
            stringify: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                // Convert
                var latin1Chars = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    latin1Chars.push(String.fromCharCode(bite));
                }

                return latin1Chars.join('');
            },

            /**
             * Converts a Latin1 string to a word array.
             *
             * @param {string} latin1Str The Latin1 string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
             */
            parse: function (latin1Str) {
                // Shortcut
                var latin1StrLength = latin1Str.length;

                // Convert
                var words = [];
                for (var i = 0; i < latin1StrLength; i++) {
                    words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
                }

                return new WordArray.init(words, latin1StrLength);
            }
        };

        /**
         * UTF-8 encoding strategy.
         */
        var Utf8 = C_enc.Utf8 = {
            /**
             * Converts a word array to a UTF-8 string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The UTF-8 string.
             *
             * @static
             *
             * @example
             *
             *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
             */
            stringify: function (wordArray) {
                try {
                    return decodeURIComponent(escape(Latin1.stringify(wordArray)));
                } catch (e) {
                    throw new Error('Malformed UTF-8 data');
                }
            },

            /**
             * Converts a UTF-8 string to a word array.
             *
             * @param {string} utf8Str The UTF-8 string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
             */
            parse: function (utf8Str) {
                return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
            }
        };

        /**
         * Abstract buffered block algorithm template.
         *
         * The property blockSize must be implemented in a concrete subtype.
         *
         * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
         */
        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
            /**
             * Resets this block algorithm's data buffer to its initial state.
             *
             * @example
             *
             *     bufferedBlockAlgorithm.reset();
             */
            reset: function () {
                // Initial values
                this._data = new WordArray.init();
                this._nDataBytes = 0;
            },

            /**
             * Adds new data to this block algorithm's buffer.
             *
             * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
             *
             * @example
             *
             *     bufferedBlockAlgorithm._append('data');
             *     bufferedBlockAlgorithm._append(wordArray);
             */
            _append: function (data) {
                // Convert string to WordArray, else assume WordArray already
                if (typeof data == 'string') {
                    data = Utf8.parse(data);
                }

                // Append
                this._data.concat(data);
                this._nDataBytes += data.sigBytes;
            },

            /**
             * Processes available data blocks.
             *
             * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
             *
             * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
             *
             * @return {WordArray} The processed data.
             *
             * @example
             *
             *     var processedData = bufferedBlockAlgorithm._process();
             *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
             */
            _process: function (doFlush) {
                // Shortcuts
                var data = this._data;
                var dataWords = data.words;
                var dataSigBytes = data.sigBytes;
                var blockSize = this.blockSize;
                var blockSizeBytes = blockSize * 4;

                // Count blocks ready
                var nBlocksReady = dataSigBytes / blockSizeBytes;
                if (doFlush) {
                    // Round up to include partial blocks
                    nBlocksReady = Math.ceil(nBlocksReady);
                } else {
                    // Round down to include only full blocks,
                    // less the number of blocks that must remain in the buffer
                    nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
                }

                // Count words ready
                var nWordsReady = nBlocksReady * blockSize;

                // Count bytes ready
                var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

                // Process blocks
                if (nWordsReady) {
                    for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                        // Perform concrete-algorithm logic
                        this._doProcessBlock(dataWords, offset);
                    }

                    // Remove processed words
                    var processedWords = dataWords.splice(0, nWordsReady);
                    data.sigBytes -= nBytesReady;
                }

                // Return processed words
                return new WordArray.init(processedWords, nBytesReady);
            },

            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = bufferedBlockAlgorithm.clone();
             */
            clone: function () {
                var clone = Base.clone.call(this);
                clone._data = this._data.clone();

                return clone;
            },

            _minBufferSize: 0
        });

        /**
         * Abstract hasher template.
         *
         * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
         */
        var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
            /**
             * Configuration options.
             */
            cfg: Base.extend(),

            /**
             * Initializes a newly created hasher.
             *
             * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
             *
             * @example
             *
             *     var hasher = CryptoJS.algo.SHA256.create();
             */
            init: function (cfg) {
                // Apply config defaults
                this.cfg = this.cfg.extend(cfg);

                // Set initial values
                this.reset();
            },

            /**
             * Resets this hasher to its initial state.
             *
             * @example
             *
             *     hasher.reset();
             */
            reset: function () {
                // Reset data buffer
                BufferedBlockAlgorithm.reset.call(this);

                // Perform concrete-hasher logic
                this._doReset();
            },

            /**
             * Updates this hasher with a message.
             *
             * @param {WordArray|string} messageUpdate The message to append.
             *
             * @return {Hasher} This hasher.
             *
             * @example
             *
             *     hasher.update('message');
             *     hasher.update(wordArray);
             */
            update: function (messageUpdate) {
                // Append
                this._append(messageUpdate);

                // Update the hash
                this._process();

                // Chainable
                return this;
            },

            /**
             * Finalizes the hash computation.
             * Note that the finalize operation is effectively a destructive, read-once operation.
             *
             * @param {WordArray|string} messageUpdate (Optional) A final message update.
             *
             * @return {WordArray} The hash.
             *
             * @example
             *
             *     var hash = hasher.finalize();
             *     var hash = hasher.finalize('message');
             *     var hash = hasher.finalize(wordArray);
             */
            finalize: function (messageUpdate) {
                // Final message update
                if (messageUpdate) {
                    this._append(messageUpdate);
                }

                // Perform concrete-hasher logic
                var hash = this._doFinalize();

                return hash;
            },

            blockSize: 512/32,

            /**
             * Creates a shortcut function to a hasher's object interface.
             *
             * @param {Hasher} hasher The hasher to create a helper for.
             *
             * @return {Function} The shortcut function.
             *
             * @static
             *
             * @example
             *
             *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
             */
            _createHelper: function (hasher) {
                return function (message, cfg) {
                    return new hasher.init(cfg).finalize(message);
                };
            },

            /**
             * Creates a shortcut function to the HMAC's object interface.
             *
             * @param {Hasher} hasher The hasher to use in this HMAC helper.
             *
             * @return {Function} The shortcut function.
             *
             * @static
             *
             * @example
             *
             *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
             */
            _createHmacHelper: function (hasher) {
                return function (message, key) {
                    return new C_algo.HMAC.init(hasher, key).finalize(message);
                };
            }
        });

        /**
         * Algorithm namespace.
         */
        var C_algo = C.algo = {};

        return C;
    }(Math));

window["Crypto"] = CryptoJS;

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var C_algo = C.algo;

    /**
     * HMAC algorithm.
     */
    var HMAC = C_algo.HMAC = Base.extend({
        /**
         * Initializes a newly created HMAC.
         *
         * @param {Hasher} hasher The hash algorithm to use.
         * @param {WordArray|string} key The secret key.
         *
         * @example
         *
         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
         */
        init: function (hasher, key) {
            // Init hasher
            hasher = this._hasher = new hasher.init();

            // Convert string to WordArray, else assume WordArray already
            if (typeof key == 'string') {
                key = Utf8.parse(key);
            }

            // Shortcuts
            var hasherBlockSize = hasher.blockSize;
            var hasherBlockSizeBytes = hasherBlockSize * 4;

            // Allow arbitrary length keys
            if (key.sigBytes > hasherBlockSizeBytes) {
                key = hasher.finalize(key);
            }

            // Clamp excess bits
            key.clamp();

            // Clone key for inner and outer pads
            var oKey = this._oKey = key.clone();
            var iKey = this._iKey = key.clone();

            // Shortcuts
            var oKeyWords = oKey.words;
            var iKeyWords = iKey.words;

            // XOR keys with pad constants
            for (var i = 0; i < hasherBlockSize; i++) {
                oKeyWords[i] ^= 0x5c5c5c5c;
                iKeyWords[i] ^= 0x36363636;
            }
            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

            // Set initial values
            this.reset();
        },

        /**
         * Resets this HMAC to its initial state.
         *
         * @example
         *
         *     hmacHasher.reset();
         */
        reset: function () {
            // Shortcut
            var hasher = this._hasher;

            // Reset
            hasher.reset();
            hasher.update(this._iKey);
        },

        /**
         * Updates this HMAC with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {HMAC} This HMAC instance.
         *
         * @example
         *
         *     hmacHasher.update('message');
         *     hmacHasher.update(wordArray);
         */
        update: function (messageUpdate) {
            this._hasher.update(messageUpdate);

            // Chainable
            return this;
        },

        /**
         * Finalizes the HMAC computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The HMAC.
         *
         * @example
         *
         *     var hmac = hmacHasher.finalize();
         *     var hmac = hmacHasher.finalize('message');
         *     var hmac = hmacHasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
            // Shortcut
            var hasher = this._hasher;

            // Compute HMAC
            var innerHash = hasher.finalize(messageUpdate);
            hasher.reset();
            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

            return hmac;
        }
    });
}());

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Initialization and round constants tables
    var H = [];
    var K = [];

    // Compute constants
    (function () {
        function isPrime(n) {
            var sqrtN = Math.sqrt(n);
            for (var factor = 2; factor <= sqrtN; factor++) {
                if (!(n % factor)) {
                    return false;
                }
            }

            return true;
        }

        function getFractionalBits(n) {
            return ((n - (n | 0)) * 0x100000000) | 0;
        }

        var n = 2;
        var nPrime = 0;
        while (nPrime < 64) {
            if (isPrime(n)) {
                if (nPrime < 8) {
                    H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
                }
                K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

                nPrime++;
            }

            n++;
        }
    }());

    // Reusable object
    var W = [];

    /**
     * SHA-256 hash algorithm.
     */
    var SHA256 = C_algo.SHA256 = Hasher.extend({
        _doReset: function () {
            this._hash = new WordArray.init(H.slice(0));
        },

        _doProcessBlock: function (M, offset) {
            // Shortcut
            var H = this._hash.words;

            // Working variables
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            var e = H[4];
            var f = H[5];
            var g = H[6];
            var h = H[7];

            // Computation
            for (var i = 0; i < 64; i++) {
                if (i < 16) {
                    W[i] = M[offset + i] | 0;
                } else {
                    var gamma0x = W[i - 15];
                    var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
                        ((gamma0x << 14) | (gamma0x >>> 18)) ^
                        (gamma0x >>> 3);

                    var gamma1x = W[i - 2];
                    var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
                        ((gamma1x << 13) | (gamma1x >>> 19)) ^
                        (gamma1x >>> 10);

                    W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
                }

                var ch  = (e & f) ^ (~e & g);
                var maj = (a & b) ^ (a & c) ^ (b & c);

                var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
                var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

                var t1 = h + sigma1 + ch + K[i] + W[i];
                var t2 = sigma0 + maj;

                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }

            // Intermediate hash value
            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0;
            H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0;
            H[7] = (H[7] + h) | 0;
        },

        _doFinalize: function () {
            // Shortcuts
            var data = this._data;
            var dataWords = data.words;

            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;

            // Add padding
            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;

            // Hash final blocks
            this._process();

            // Return final computed hash
            return this._hash;
        },

        clone: function () {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();

            return clone;
        }
    });

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA256('message');
     *     var hash = CryptoJS.SHA256(wordArray);
     */
    C.SHA256 = Hasher._createHelper(SHA256);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA256(message, key);
     */
    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
}(Math));

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * Base64 encoding strategy.
     */
    var Base64 = C_enc.Base64 = {
        /**
         * Converts a word array to a Base64 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Base64 string.
         *
         * @static
         *
         * @example
         *
         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
         */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;

            // Clamp excess bits
            wordArray.clamp();

            // Convert
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
                }
            }

            // Add padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                while (base64Chars.length % 4) {
                    base64Chars.push(paddingChar);
                }
            }

            return base64Chars.join('');
        },

        /**
         * Converts a Base64 string to a word array.
         *
         * @param {string} base64Str The Base64 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
         */
        parse: function (base64Str) {
            // Shortcuts
            var base64StrLength = base64Str.length;
            var map = this._map;

            // Ignore padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                var paddingIndex = base64Str.indexOf(paddingChar);
                if (paddingIndex != -1) {
                    base64StrLength = paddingIndex;
                }
            }

            // Convert
            var words = [];
            var nBytes = 0;
            for (var i = 0; i < base64StrLength; i++) {
                if (i % 4) {
                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
                    nBytes++;
                }
            }

            return WordArray.create(words, nBytes);
        },

        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    };
}());
(function(scope){
var CryptoJS=CryptoJS||function(e,n){var t={},i=t.lib={},r=function(){},s=i.Base={extend:function(e){r.prototype=this;var n=new r;return e&&n.mixIn(e),n.hasOwnProperty("init")||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function(){var e=this.extend();return e.init.apply(e,arguments),e},init:function(){},mixIn:function(e){for(var n in e)e.hasOwnProperty(n)&&(this[n]=e[n]);e.hasOwnProperty("toString")&&(this.toString=e.toString)},clone:function(){return this.init.prototype.extend(this)}},o=i.WordArray=s.extend({init:function(e,n){e=this.words=e||[],this.sigBytes=void 0!=n?n:4*e.length},toString:function(e){return(e||u).stringify(this)},concat:function(e){var n=this.words,t=e.words,i=this.sigBytes;if(e=e.sigBytes,this.clamp(),i%4)for(var r=0;r<e;r++)n[i+r>>>2]|=(t[r>>>2]>>>24-r%4*8&255)<<24-(i+r)%4*8;else if(65535<t.length)for(r=0;r<e;r+=4)n[i+r>>>2]=t[r>>>2];else n.push.apply(n,t);return this.sigBytes+=e,this},clamp:function(){var n=this.words,t=this.sigBytes;n[t>>>2]&=4294967295<<32-t%4*8,n.length=e.ceil(t/4)},clone:function(){var e=s.clone.call(this);return e.words=this.words.slice(0),e},random:function(n){for(var t=[],i=0;i<n;i+=4)t.push(4294967296*e.random()|0);return new o.init(t,n)}}),a=t.enc={},u=a.Hex={stringify:function(e){var n=e.words;e=e.sigBytes;for(var t=[],i=0;i<e;i++){var r=n[i>>>2]>>>24-i%4*8&255;t.push((r>>>4).toString(16)),t.push((15&r).toString(16))}return t.join("")},parse:function(e){for(var n=e.length,t=[],i=0;i<n;i+=2)t[i>>>3]|=parseInt(e.substr(i,2),16)<<24-i%8*4;return new o.init(t,n/2)}},c=a.Latin1={stringify:function(e){var n=e.words;e=e.sigBytes;for(var t=[],i=0;i<e;i++)t.push(String.fromCharCode(n[i>>>2]>>>24-i%4*8&255));return t.join("")},parse:function(e){for(var n=e.length,t=[],i=0;i<n;i++)t[i>>>2]|=(255&e.charCodeAt(i))<<24-i%4*8;return new o.init(t,n)}},d=a.Utf8={stringify:function(e){try{return decodeURIComponent(escape(c.stringify(e)))}catch(e){throw Error("Malformed UTF-8 data")}},parse:function(e){return c.parse(unescape(encodeURIComponent(e)))}},l=i.BufferedBlockAlgorithm=s.extend({reset:function(){this._data=new o.init,this._nDataBytes=0},_append:function(e){"string"==typeof e&&(e=d.parse(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes},_process:function(n){var t=this._data,i=t.words,r=t.sigBytes,s=this.blockSize,a=r/(4*s),a=n?e.ceil(a):e.max((0|a)-this._minBufferSize,0);if(n=a*s,r=e.min(4*n,r),n){for(var u=0;u<n;u+=s)this._doProcessBlock(i,u);u=i.splice(0,n),t.sigBytes-=r}return new o.init(u,r)},clone:function(){var e=s.clone.call(this);return e._data=this._data.clone(),e},_minBufferSize:0});i.Hasher=l.extend({cfg:s.extend(),init:function(e){this.cfg=this.cfg.extend(e),this.reset()},reset:function(){l.reset.call(this),this._doReset()},update:function(e){return this._append(e),this._process(),this},finalize:function(e){return e&&this._append(e),this._doFinalize()},blockSize:16,_createHelper:function(e){return function(n,t){return new e.init(t).finalize(n)}},_createHmacHelper:function(e){return function(n,t){return new f.HMAC.init(e,t).finalize(n)}}});var f=t.algo={};return t}(Math);!function(e){for(var n=CryptoJS,t=n.lib,i=t.WordArray,r=t.Hasher,t=n.algo,s=[],o=[],a=function(e){return 4294967296*(e-(0|e))|0},u=2,c=0;64>c;){var d;e:{d=u;for(var l=e.sqrt(d),f=2;f<=l;f++)if(!(d%f)){d=!1;break e}d=!0}d&&(8>c&&(s[c]=a(e.pow(u,.5))),o[c]=a(e.pow(u,1/3)),c++),u++}var v=[],t=t.SHA256=r.extend({_doReset:function(){this._hash=new i.init(s.slice(0))},_doProcessBlock:function(e,n){for(var t=this._hash.words,i=t[0],r=t[1],s=t[2],a=t[3],u=t[4],c=t[5],d=t[6],l=t[7],f=0;64>f;f++){if(16>f)v[f]=0|e[n+f];else{var g=v[f-15],m=v[f-2];v[f]=((g<<25|g>>>7)^(g<<14|g>>>18)^g>>>3)+v[f-7]+((m<<15|m>>>17)^(m<<13|m>>>19)^m>>>10)+v[f-16]}g=l+((u<<26|u>>>6)^(u<<21|u>>>11)^(u<<7|u>>>25))+(u&c^~u&d)+o[f]+v[f],m=((i<<30|i>>>2)^(i<<19|i>>>13)^(i<<10|i>>>22))+(i&r^i&s^r&s),l=d,d=c,c=u,u=a+g|0,a=s,s=r,r=i,i=g+m|0}t[0]=t[0]+i|0,t[1]=t[1]+r|0,t[2]=t[2]+s|0,t[3]=t[3]+a|0,t[4]=t[4]+u|0,t[5]=t[5]+c|0,t[6]=t[6]+d|0,t[7]=t[7]+l|0},_doFinalize:function(){var n=this._data,t=n.words,i=8*this._nDataBytes,r=8*n.sigBytes;return t[r>>>5]|=128<<24-r%32,t[14+(r+64>>>9<<4)]=e.floor(i/4294967296),t[15+(r+64>>>9<<4)]=i,n.sigBytes=4*t.length,this._process(),this._hash},clone:function(){var e=r.clone.call(this);return e._hash=this._hash.clone(),e}});n.SHA256=r._createHelper(t),n.HmacSHA256=r._createHmacHelper(t)}(Math),function(){var e=CryptoJS,n=e.enc.Utf8;e.algo.HMAC=e.lib.Base.extend({init:function(e,t){e=this._hasher=new e.init,"string"==typeof t&&(t=n.parse(t));var i=e.blockSize,r=4*i;t.sigBytes>r&&(t=e.finalize(t)),t.clamp();for(var s=this._oKey=t.clone(),o=this._iKey=t.clone(),a=s.words,u=o.words,c=0;c<i;c++)a[c]^=1549556828,u[c]^=909522486;s.sigBytes=o.sigBytes=r,this.reset()},reset:function(){var e=this._hasher;e.reset(),e.update(this._iKey)},update:function(e){return this._hasher.update(e),this},finalize:function(e){var n=this._hasher;return e=n.finalize(e),n.reset(),n.finalize(this._oKey.clone().concat(e))}})}(),function(){var e=CryptoJS,n=e.lib.WordArray;e.enc.Base64={stringify:function(e){var n=e.words,t=e.sigBytes,i=this._map;e.clamp(),e=[];for(var r=0;r<t;r+=3)for(var s=(n[r>>>2]>>>24-r%4*8&255)<<16|(n[r+1>>>2]>>>24-(r+1)%4*8&255)<<8|n[r+2>>>2]>>>24-(r+2)%4*8&255,o=0;4>o&&r+.75*o<t;o++)e.push(i.charAt(s>>>6*(3-o)&63));if(n=i.charAt(64))for(;e.length%4;)e.push(n);return e.join("")},parse:function(e){var t=e.length,i=this._map,r=i.charAt(64);r&&-1!=(r=e.indexOf(r))&&(t=r);for(var r=[],s=0,o=0;o<t;o++)if(o%4){var a=i.indexOf(e.charAt(o-1))<<o%4*2,u=i.indexOf(e.charAt(o))>>>6-o%4*2;r[s>>>2]|=(a|u)<<24-s%4*8,s++}return n.create(r,s)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}();var gameanalytics;!function(e){!function(e){e[e.Undefined=0]="Undefined",e[e.Debug=1]="Debug",e[e.Info=2]="Info",e[e.Warning=3]="Warning",e[e.Error=4]="Error",e[e.Critical=5]="Critical"}(e.EGAErrorSeverity||(e.EGAErrorSeverity={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Male=1]="Male",e[e.Female=2]="Female"}(e.EGAGender||(e.EGAGender={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Start=1]="Start",e[e.Complete=2]="Complete",e[e.Fail=3]="Fail"}(e.EGAProgressionStatus||(e.EGAProgressionStatus={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Source=1]="Source",e[e.Sink=2]="Sink"}(e.EGAResourceFlowType||(e.EGAResourceFlowType={}));!function(e){!function(e){e[e.Undefined=0]="Undefined",e[e.Rejected=1]="Rejected"}(e.EGASdkErrorType||(e.EGASdkErrorType={}));!function(e){e[e.NoResponse=0]="NoResponse",e[e.BadResponse=1]="BadResponse",e[e.RequestTimeout=2]="RequestTimeout",e[e.JsonEncodeFailed=3]="JsonEncodeFailed",e[e.JsonDecodeFailed=4]="JsonDecodeFailed",e[e.InternalServerError=5]="InternalServerError",e[e.BadRequest=6]="BadRequest",e[e.Unauthorized=7]="Unauthorized",e[e.UnknownResponseCode=8]="UnknownResponseCode",e[e.Ok=9]="Ok"}(e.EGAHTTPApiResponse||(e.EGAHTTPApiResponse={}))}(e.http||(e.http={}))}(gameanalytics||(gameanalytics={}));var EGAErrorSeverity=gameanalytics.EGAErrorSeverity,EGAGender=gameanalytics.EGAGender,EGAProgressionStatus=gameanalytics.EGAProgressionStatus,EGAResourceFlowType=gameanalytics.EGAResourceFlowType,gameanalytics;!function(e){!function(e){var n;!function(e){e[e.Error=0]="Error",e[e.Warning=1]="Warning",e[e.Info=2]="Info",e[e.Debug=3]="Debug"}(n||(n={}));var t=function(){function e(){e.debugEnabled=!1}return e.setInfoLog=function(n){e.instance.infoLogEnabled=n},e.setVerboseLog=function(n){e.instance.infoLogVerboseEnabled=n},e.i=function(t){if(e.instance.infoLogEnabled){var i="Info/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Info)}},e.w=function(t){var i="Warning/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Warning)},e.e=function(t){var i="Error/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Error)},e.ii=function(t){if(e.instance.infoLogVerboseEnabled){var i="Verbose/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Info)}},e.d=function(t){if(e.debugEnabled){var i="Debug/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Debug)}},e.prototype.sendNotificationMessage=function(e,t){switch(t){case n.Error:console.error(e);break;case n.Warning:console.warn(e);break;case n.Debug:"function"==typeof console.debug?console.debug(e):console.log(e);break;case n.Info:console.log(e)}},e}();t.instance=new t,t.Tag="GameAnalytics",e.GALogger=t}(e.logging||(e.logging={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.logging.GALogger,i=function(){function e(){}return e.getHmac=function(e,n){var t=CryptoJS.HmacSHA256(n,e);return CryptoJS.enc.Base64.stringify(t)},e.stringMatch=function(e,n){return!(!e||!n)&&n.test(e)},e.joinStringArray=function(e,n){for(var t="",i=0,r=e.length;i<r;i++)i>0&&(t+=n),t+=e[i];return t},e.stringArrayContainsString=function(e,n){if(0===e.length)return!1;for(var t in e)if(e[t]===n)return!0;return!1},e.encode64=function(n){n=encodeURI(n);var t,i,r,s,o,a="",u=0,c=0,d=0;do{t=n.charCodeAt(d++),i=n.charCodeAt(d++),u=n.charCodeAt(d++),r=t>>2,s=(3&t)<<4|i>>4,o=(15&i)<<2|u>>6,c=63&u,isNaN(i)?o=c=64:isNaN(u)&&(c=64),a=a+e.keyStr.charAt(r)+e.keyStr.charAt(s)+e.keyStr.charAt(o)+e.keyStr.charAt(c),t=i=u=0,r=s=o=c=0}while(d<n.length);return a},e.decode64=function(n){var i,r,s,o,a,u="",c=0,d=0,l=0;/[^A-Za-z0-9\+\/\=]/g.exec(n)&&t.w("There were invalid base64 characters in the input text. Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='. Expect errors in decoding."),n=n.replace(/[^A-Za-z0-9\+\/\=]/g,"");do{s=e.keyStr.indexOf(n.charAt(l++)),o=e.keyStr.indexOf(n.charAt(l++)),a=e.keyStr.indexOf(n.charAt(l++)),d=e.keyStr.indexOf(n.charAt(l++)),i=s<<2|o>>4,r=(15&o)<<4|a>>2,c=(3&a)<<6|d,u+=String.fromCharCode(i),64!=a&&(u+=String.fromCharCode(r)),64!=d&&(u+=String.fromCharCode(c)),i=r=c=0,s=o=a=d=0}while(l<n.length);return decodeURI(u)},e.timeIntervalSince1970=function(){var e=new Date;return Math.round(e.getTime()/1e3)},e.createGuid=function(){return(e.s4()+e.s4()+"-"+e.s4()+"-4"+e.s4().substr(0,3)+"-"+e.s4()+"-"+e.s4()+e.s4()+e.s4()).toLowerCase()},e.s4=function(){return(65536*(1+Math.random())|0).toString(16).substring(1)},e}();i.keyStr="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n.GAUtilities=i}(e.utilities||(e.utilities={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.logging.GALogger,i=e.http.EGASdkErrorType,r=e.utilities.GAUtilities,s=function(){function n(){}return n.validateBusinessEvent=function(e,i,r,s,o){return n.validateCurrency(e)?n.validateShortString(r,!0)?n.validateEventPartLength(s,!1)?n.validateEventPartCharacters(s)?n.validateEventPartLength(o,!1)?!!n.validateEventPartCharacters(o)||(t.i("Validation fail - business event - itemId: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+o),!1):(t.i("Validation fail - business event - itemId. Cannot be (null), empty or above 64 characters. String: "+o),!1):(t.i("Validation fail - business event - itemType: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+s),!1):(t.i("Validation fail - business event - itemType: Cannot be (null), empty or above 64 characters. String: "+s),!1):(t.i("Validation fail - business event - cartType. Cannot be above 32 length. String: "+r),!1):(t.i("Validation fail - business event - currency: Cannot be (null) and need to be A-Z, 3 characters and in the standard at openexchangerates.org. Failed currency: "+e),!1)},n.validateResourceEvent=function(i,s,o,a,u,c,d){return i==e.EGAResourceFlowType.Undefined?(t.i("Validation fail - resource event - flowType: Invalid flow type."),!1):s?r.stringArrayContainsString(c,s)?o>0?a?n.validateEventPartLength(a,!1)?n.validateEventPartCharacters(a)?r.stringArrayContainsString(d,a)?n.validateEventPartLength(u,!1)?!!n.validateEventPartCharacters(u)||(t.i("Validation fail - resource event - itemId: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+u),!1):(t.i("Validation fail - resource event - itemId: Cannot be (null), empty or above 64 characters. String: "+u),!1):(t.i("Validation fail - resource event - itemType: Not found in list of pre-defined available resource itemTypes. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot be (null), empty or above 64 characters. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot be (null)"),!1):(t.i("Validation fail - resource event - amount: Float amount cannot be 0 or negative. Value: "+o),!1):(t.i("Validation fail - resource event - currency: Not found in list of pre-defined available resource currencies. String: "+s),!1):(t.i("Validation fail - resource event - currency: Cannot be (null)"),!1)},n.validateProgressionEvent=function(i,r,s,o){if(i==e.EGAProgressionStatus.Undefined)return t.i("Validation fail - progression event: Invalid progression status."),!1;if(o&&!s&&r)return t.i("Validation fail - progression event: 03 found but 01+02 are invalid. Progression must be set as either 01, 01+02 or 01+02+03."),!1;if(s&&!r)return t.i("Validation fail - progression event: 02 found but not 01. Progression must be set as either 01, 01+02 or 01+02+03"),!1;if(!r)return t.i("Validation fail - progression event: progression01 not valid. Progressions must be set as either 01, 01+02 or 01+02+03"),!1;if(!n.validateEventPartLength(r,!1))return t.i("Validation fail - progression event - progression01: Cannot be (null), empty or above 64 characters. String: "+r),!1;if(!n.validateEventPartCharacters(r))return t.i("Validation fail - progression event - progression01: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+r),!1;if(s){if(!n.validateEventPartLength(s,!0))return t.i("Validation fail - progression event - progression02: Cannot be empty or above 64 characters. String: "+s),!1;if(!n.validateEventPartCharacters(s))return t.i("Validation fail - progression event - progression02: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+s),!1}if(o){if(!n.validateEventPartLength(o,!0))return t.i("Validation fail - progression event - progression03: Cannot be empty or above 64 characters. String: "+o),!1;if(!n.validateEventPartCharacters(o))return t.i("Validation fail - progression event - progression03: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+o),!1}return!0},n.validateDesignEvent=function(e,i){return n.validateEventIdLength(e)?!!n.validateEventIdCharacters(e)||(t.i("Validation fail - design event - eventId: Non valid characters. Only allowed A-z, 0-9, -_., ()!?. String: "+e),!1):(t.i("Validation fail - design event - eventId: Cannot be (null) or empty. Only 5 event parts allowed seperated by :. Each part need to be 32 characters or less. String: "+e),!1)},n.validateErrorEvent=function(i,r){return i==e.EGAErrorSeverity.Undefined?(t.i("Validation fail - error event - severity: Severity was unsupported value."),!1):!!n.validateLongString(r,!0)||(t.i("Validation fail - error event - message: Message cannot be above 8192 characters."),!1)},n.validateSdkErrorEvent=function(e,r,s){return!!n.validateKeys(e,r)&&(s!==i.Undefined||(t.i("Validation fail - sdk error event - type: Type was unsupported value."),!1))},n.validateKeys=function(e,n){return!(!r.stringMatch(e,/^[A-z0-9]{32}$/)||!r.stringMatch(n,/^[A-z0-9]{40}$/))},n.validateCurrency=function(e){return!!e&&!!r.stringMatch(e,/^[A-Z]{3}$/)},n.validateEventPartLength=function(e,n){return!(!n||e)||!!e&&!(e.length>64)},n.validateEventPartCharacters=function(e){return!!r.stringMatch(e,/^[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}$/)},n.validateEventIdLength=function(e){return!!e&&!!r.stringMatch(e,/^[^:]{1,64}(?::[^:]{1,64}){0,4}$/)},n.validateEventIdCharacters=function(e){return!!e&&!!r.stringMatch(e,/^[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}(:[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}){0,4}$/)},n.validateAndCleanInitRequestResponse=function(e){if(null==e)return t.w("validateInitRequestResponse failed - no response dictionary."),null;var n={};try{n.enabled=e.enabled}catch(e){return t.w("validateInitRequestResponse failed - invalid type in 'enabled' field."),null}try{var i=e.server_ts;if(!(i>0))return t.w("validateInitRequestResponse failed - invalid value in 'server_ts' field."),null;n.server_ts=i}catch(n){return t.w("validateInitRequestResponse failed - invalid type in 'server_ts' field. type="+typeof e.server_ts+", value="+e.server_ts+", "+n),null}return n},n.validateBuild=function(e){return!!n.validateShortString(e,!1)},n.validateSdkWrapperVersion=function(e){return!!r.stringMatch(e,/^(unity|unreal|gamemaker|cocos2d|construct) [0-9]{0,5}(\.[0-9]{0,5}){0,2}$/)},n.validateEngineVersion=function(e){return!(!e||!r.stringMatch(e,/^(unity|unreal|gamemaker|cocos2d|construct) [0-9]{0,5}(\.[0-9]{0,5}){0,2}$/))},n.validateUserId=function(e){return!!n.validateString(e,!1)||(t.i("Validation fail - user id: id cannot be (null), empty or above 64 characters."),!1)},n.validateShortString=function(e,n){return!(!n||e)||!(!e||e.length>32)},n.validateString=function(e,n){return!(!n||e)||!(!e||e.length>64)},n.validateLongString=function(e,n){return!(!n||e)||!(!e||e.length>8192)},n.validateConnectionType=function(e){return r.stringMatch(e,/^(wwan|wifi|lan|offline)$/)},n.validateCustomDimensions=function(e){return n.validateArrayOfStrings(20,32,!1,"custom dimensions",e)},n.validateResourceCurrencies=function(e){if(!n.validateArrayOfStrings(20,64,!1,"resource currencies",e))return!1;for(var i=0;i<e.length;++i)if(!r.stringMatch(e[i],/^[A-Za-z]+$/))return t.i("resource currencies validation failed: a resource currency can only be A-Z, a-z. String was: "+e[i]),!1;return!0},n.validateResourceItemTypes=function(e){if(!n.validateArrayOfStrings(20,32,!1,"resource item types",e))return!1;for(var i=0;i<e.length;++i)if(!n.validateEventPartCharacters(e[i]))return t.i("resource item types validation failed: a resource item type cannot contain other characters than A-z, 0-9, -_., ()!?. String was: "+e[i]),!1;return!0},n.validateDimension01=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateDimension02=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateDimension03=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateArrayOfStrings=function(e,n,i,r,s){var o=r;if(o||(o="Array"),!s)return t.i(o+" validation failed: array cannot be null. "),!1;if(0==i&&0==s.length)return t.i(o+" validation failed: array cannot be empty. "),!1;if(e>0&&s.length>e)return t.i(o+" validation failed: array cannot exceed "+e+" values. It has "+s.length+" values."),!1;for(var a=0;a<s.length;++a){var u=s[a]?s[a].length:0;if(0===u)return t.i(o+" validation failed: contained an empty string. Array="+JSON.stringify(s)),!1;if(n>0&&u>n)return t.i(o+" validation failed: a string exceeded max allowed length (which is: "+n+"). String was: "+s[a]),!1}return!0},n.validateFacebookId=function(e){return!!n.validateString(e,!1)||(t.i("Validation fail - facebook id: id cannot be (null), empty or above 64 characters."),!1)},n.validateGender=function(n){if(isNaN(Number(e.EGAGender[n]))){if(n==e.EGAGender.Undefined||n!=e.EGAGender.Male&&n!=e.EGAGender.Female)return t.i("Validation fail - gender: Has to be 'male' or 'female'. Was: "+n),!1}else if(n==e.EGAGender[e.EGAGender.Undefined]||n!=e.EGAGender[e.EGAGender.Male]&&n!=e.EGAGender[e.EGAGender.Female])return t.i("Validation fail - gender: Has to be 'male' or 'female'. Was: "+n),!1;return!0},n.validateBirthyear=function(e){return!(e<0||e>9999)||(t.i("Validation fail - birthYear: Cannot be (null) or invalid range."),!1)},n.validateClientTs=function(e){return!(e<-4294967294||e>4294967294)},n}();n.GAValidator=s}(e.validators||(e.validators={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(e){var n=function(){function e(e,n,t){this.name=e,this.value=n,this.version=t}return e}();e.NameValueVersion=n;var t=function(){function e(e,n){this.name=e,this.version=n}return e}();e.NameVersion=t;var i=function(){function e(){}return e.touch=function(){},e.getRelevantSdkVersion=function(){return e.sdkGameEngineVersion?e.sdkGameEngineVersion:e.sdkWrapperVersion},e.getConnectionType=function(){return e.connectionType},e.updateConnectionType=function(){navigator.onLine?"ios"===e.buildPlatform||"android"===e.buildPlatform?e.connectionType="wwan":e.connectionType="lan":e.connectionType="offline"},e.getOSVersionString=function(){return e.buildPlatform+" "+e.osVersionPair.version},e.runtimePlatformToString=function(){return e.osVersionPair.name},e.getBrowserVersionString=function(){var e,n=navigator.userAgent,t=n.match(/(opera|chrome|safari|firefox|ubrowser|msie|trident(?=\/))\/?\s*(\d+)/i)||[];if(/trident/i.test(t[1]))return e=/\brv[ :]+(\d+)/g.exec(n)||[],"IE "+(e[1]||"");if("Chrome"===t[1]&&null!=(e=n.match(/\b(OPR|Edge|UBrowser)\/(\d+)/)))return e.slice(1).join(" ").replace("OPR","Opera").replace("UBrowser","UC").toLowerCase();var i=t[2]?[t[1],t[2]]:[navigator.appName,navigator.appVersion,"-?"];return null!=(e=n.match(/version\/(\d+)/i))&&i.splice(1,1,e[1]),i.join(" ").toLowerCase()},e.getDeviceModel=function(){return"unknown"},e.getDeviceManufacturer=function(){return"unknown"},e.matchItem=function(e,n){var i,r,s,o,a,u=new t("unknown","0.0.0"),c=0,d=0;for(c=0;c<n.length;c+=1)if(i=new RegExp(n[c].value,"i"),i.test(e)){if(r=new RegExp(n[c].version+"[- /:;]([\\d._]+)","i"),s=e.match(r),a="",s&&s[1]&&(o=s[1]),o){var l=o.split(/[._]+/);for(d=0;d<Math.min(l.length,3);d+=1)a+=l[d]+(d<Math.min(l.length,3)-1?".":"")}else a="0.0.0";return u.name=n[c].name,u.version=a,u}return u},e}();i.sdkWrapperVersion="javascript 2.1.0",i.osVersionPair=i.matchItem([navigator.platform,navigator.userAgent,navigator.appVersion,navigator.vendor,window.opera].join(" "),[new n("windows_phone","Windows Phone","OS"),new n("windows","Win","NT"),new n("ios","iPhone","OS"),new n("ios","iPad","OS"),new n("ios","iPod","OS"),new n("android","Android","Android"),new n("blackBerry","BlackBerry","/"),new n("mac_osx","Mac","OS X"),new n("tizen","Tizen","Tizen"),new n("linux","Linux","rv")]),i.buildPlatform=i.runtimePlatformToString(),i.deviceModel=i.getDeviceModel(),i.deviceManufacturer=i.getDeviceManufacturer(),i.osVersion=i.getOSVersionString(),i.browserVersion=i.getBrowserVersionString(),i.maxSafeInteger=Math.pow(2,53)-1,e.GADevice=i}(e.device||(e.device={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(e){var n=function(){function e(n){this.deadline=n,this.ignore=!1,this.async=!1,this.running=!1,this.id=++e.idCounter}return e}();n.idCounter=0,e.TimedBlock=n}(e.threading||(e.threading={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(e){var n=function(){function e(e){this.comparer=e,this._subQueues={},this._sortedKeys=[]}return e.prototype.enqueue=function(e,n){-1===this._sortedKeys.indexOf(e)&&this.addQueueOfPriority(e),this._subQueues[e].push(n)},e.prototype.addQueueOfPriority=function(e){var n=this;this._sortedKeys.push(e),this._sortedKeys.sort(function(e,t){return n.comparer.compare(e,t)}),this._subQueues[e]=[]},e.prototype.peek=function(){if(this.hasItems())return this._subQueues[this._sortedKeys[0]][0];throw new Error("The queue is empty")},e.prototype.hasItems=function(){return this._sortedKeys.length>0},e.prototype.dequeue=function(){if(this.hasItems())return this.dequeueFromHighPriorityQueue();throw new Error("The queue is empty")},e.prototype.dequeueFromHighPriorityQueue=function(){var e=this._sortedKeys[0],n=this._subQueues[e].shift();return 0===this._subQueues[e].length&&(this._sortedKeys.shift(),delete this._subQueues[e]),n},e}();e.PriorityQueue=n}(e.threading||(e.threading={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t,i=e.logging.GALogger;!function(e){e[e.Equal=0]="Equal",e[e.LessOrEqual=1]="LessOrEqual",e[e.NotEqual=2]="NotEqual"}(t=n.EGAStoreArgsOperator||(n.EGAStoreArgsOperator={}));var r;!function(e){e[e.Events=0]="Events",e[e.Sessions=1]="Sessions",e[e.Progression=2]="Progression"}(r=n.EGAStore||(n.EGAStore={}));var s=function(){function e(){this.eventsStore=[],this.sessionsStore=[],this.progressionStore=[],this.storeItems={};try{"object"==typeof localStorage?(localStorage.setItem("testingLocalStorage","yes"),localStorage.removeItem("testingLocalStorage"),e.storageAvailable=!0):e.storageAvailable=!1}catch(e){}}return e.isStorageAvailable=function(){return e.storageAvailable},e.isStoreTooLargeForEvents=function(){return e.instance.eventsStore.length+e.instance.sessionsStore.length>e.MaxNumberOfEntries},e.select=function(n,i,r,s){void 0===i&&(i=[]),void 0===r&&(r=!1),void 0===s&&(s=0);var o=e.getStore(n);if(!o)return null;for(var a=[],u=0;u<o.length;++u){for(var c=o[u],d=!0,l=0;l<i.length;++l){var f=i[l];if(c[f[0]])switch(f[1]){case t.Equal:d=c[f[0]]==f[2];break;case t.LessOrEqual:d=c[f[0]]<=f[2];break;case t.NotEqual:d=c[f[0]]!=f[2];break;default:d=!1}else d=!1;if(!d)break}d&&a.push(c)}return r&&a.sort(function(e,n){return e.client_ts-n.client_ts}),s>0&&a.length>s&&(a=a.slice(0,s+1)),a},e.update=function(n,i,r){void 0===r&&(r=[]);var s=e.getStore(n);if(!s)return!1;for(var o=0;o<s.length;++o){for(var a=s[o],u=!0,c=0;c<r.length;++c){var d=r[c];if(a[d[0]])switch(d[1]){case t.Equal:u=a[d[0]]==d[2];break;case t.LessOrEqual:u=a[d[0]]<=d[2];break;case t.NotEqual:u=a[d[0]]!=d[2];break;default:u=!1}else u=!1;if(!u)break}if(u)for(var c=0;c<i.length;++c){var l=i[c];a[l[0]]=l[1]}}return!0},e.delete=function(n,i){var r=e.getStore(n);if(r)for(var s=0;s<r.length;++s){for(var o=r[s],a=!0,u=0;u<i.length;++u){var c=i[u];if(o[c[0]])switch(c[1]){case t.Equal:a=o[c[0]]==c[2];break;case t.LessOrEqual:a=o[c[0]]<=c[2];break;case t.NotEqual:a=o[c[0]]!=c[2];break;default:a=!1}else a=!1;if(!a)break}a&&(r.splice(s,1),--s)}},e.insert=function(n,t,i,r){void 0===i&&(i=!1),void 0===r&&(r=null);var s=e.getStore(n);if(s)if(i){if(!r)return;for(var o=!1,a=0;a<s.length;++a){var u=s[a];if(u[r]==t[r]){for(var c in t)u[c]=t[c];o=!0;break}}o||s.push(t)}else s.push(t)},e.save=function(){if(!e.isStorageAvailable())return void i.w("Storage is not available, cannot save.");localStorage.setItem(e.KeyPrefix+e.EventsStoreKey,JSON.stringify(e.instance.eventsStore)),localStorage.setItem(e.KeyPrefix+e.SessionsStoreKey,JSON.stringify(e.instance.sessionsStore)),localStorage.setItem(e.KeyPrefix+e.ProgressionStoreKey,JSON.stringify(e.instance.progressionStore)),localStorage.setItem(e.KeyPrefix+e.ItemsStoreKey,JSON.stringify(e.instance.storeItems))},e.load=function(){if(!e.isStorageAvailable())return void i.w("Storage is not available, cannot load.");try{e.instance.eventsStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.EventsStoreKey)),e.instance.eventsStore||(e.instance.eventsStore=[])}catch(n){i.w("Load failed for 'events' store. Using empty store."),e.instance.eventsStore=[]}try{e.instance.sessionsStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.SessionsStoreKey)),e.instance.sessionsStore||(e.instance.sessionsStore=[])}catch(n){i.w("Load failed for 'sessions' store. Using empty store."),e.instance.sessionsStore=[]}try{e.instance.progressionStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.ProgressionStoreKey)),e.instance.progressionStore||(e.instance.progressionStore=[])}catch(n){i.w("Load failed for 'progression' store. Using empty store."),e.instance.progressionStore=[]}try{e.instance.storeItems=JSON.parse(localStorage.getItem(e.KeyPrefix+e.ItemsStoreKey)),e.instance.storeItems||(e.instance.storeItems={})}catch(n){i.w("Load failed for 'items' store. Using empty store."),e.instance.progressionStore=[]}},e.setItem=function(n,t){var i=e.KeyPrefix+n;t?e.instance.storeItems[i]=t:i in e.instance.storeItems&&delete e.instance.storeItems[i]},e.getItem=function(n){var t=e.KeyPrefix+n;return t in e.instance.storeItems?e.instance.storeItems[t]:null},e.getStore=function(n){switch(n){case r.Events:return e.instance.eventsStore;case r.Sessions:return e.instance.sessionsStore;case r.Progression:return e.instance.progressionStore;default:return i.w("GAStore.getStore(): Cannot find store: "+n),null}},e}();s.instance=new s,s.MaxNumberOfEntries=2e3,s.KeyPrefix="GA::",s.EventsStoreKey="ga_event",s.SessionsStoreKey="ga_session",s.ProgressionStoreKey="ga_progression",s.ItemsStoreKey="ga_items",n.GAStore=s}(e.store||(e.store={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.validators.GAValidator,i=e.utilities.GAUtilities,r=e.logging.GALogger,s=e.store.GAStore,o=e.device.GADevice,a=e.store.EGAStore,u=e.store.EGAStoreArgsOperator,c=function(){function n(){this.availableCustomDimensions01=[],this.availableCustomDimensions02=[],this.availableCustomDimensions03=[],this.availableResourceCurrencies=[],this.availableResourceItemTypes=[],this.sdkConfigDefault={},this.sdkConfig={},this.progressionTries={}}return n.setUserId=function(e){n.instance.userId=e,n.cacheIdentifier()},n.getIdentifier=function(){return n.instance.identifier},n.isInitialized=function(){return n.instance.initialized},n.setInitialized=function(e){n.instance.initialized=e},n.getSessionStart=function(){return n.instance.sessionStart},n.getSessionNum=function(){return n.instance.sessionNum},n.getTransactionNum=function(){return n.instance.transactionNum},n.getSessionId=function(){return n.instance.sessionId},n.getCurrentCustomDimension01=function(){return n.instance.currentCustomDimension01},n.getCurrentCustomDimension02=function(){return n.instance.currentCustomDimension02},n.getCurrentCustomDimension03=function(){return n.instance.currentCustomDimension03},n.getGameKey=function(){return n.instance.gameKey},n.getGameSecret=function(){return n.instance.gameSecret},n.getAvailableCustomDimensions01=function(){return n.instance.availableCustomDimensions01},n.setAvailableCustomDimensions01=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions01=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom01 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableCustomDimensions02=function(){return n.instance.availableCustomDimensions02},n.setAvailableCustomDimensions02=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions02=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom02 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableCustomDimensions03=function(){return n.instance.availableCustomDimensions03},n.setAvailableCustomDimensions03=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions03=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom03 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableResourceCurrencies=function(){return n.instance.availableResourceCurrencies},n.setAvailableResourceCurrencies=function(e){t.validateResourceCurrencies(e)&&(n.instance.availableResourceCurrencies=e,r.i("Set available resource currencies: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableResourceItemTypes=function(){return n.instance.availableResourceItemTypes},n.setAvailableResourceItemTypes=function(e){t.validateResourceItemTypes(e)&&(n.instance.availableResourceItemTypes=e,r.i("Set available resource item types: ("+i.joinStringArray(e,", ")+")"))},n.getBuild=function(){return n.instance.build},n.setBuild=function(e){n.instance.build=e,r.i("Set build version: "+e)},n.getUseManualSessionHandling=function(){return n.instance.useManualSessionHandling},n.prototype.setDefaultId=function(e){this.defaultUserId=e||"",n.cacheIdentifier()},n.getDefaultId=function(){return n.instance.defaultUserId},n.getSdkConfig=function(){var e,t=0;for(var i in n.instance.sdkConfig)0===t&&(e=i),++t;if(e&&t>0)return n.instance.sdkConfig;var e,t=0;for(var i in n.instance.sdkConfigCached)0===t&&(e=i),++t;return e&&t>0?n.instance.sdkConfigCached:n.instance.sdkConfigDefault},n.isEnabled=function(){var e=n.getSdkConfig()
;return(!e.enabled||"false"!=e.enabled)&&!!n.instance.initAuthorized},n.setCustomDimension01=function(e){n.instance.currentCustomDimension01=e,s.setItem(n.Dimension01Key,e),r.i("Set custom01 dimension value: "+e)},n.setCustomDimension02=function(e){n.instance.currentCustomDimension02=e,s.setItem(n.Dimension02Key,e),r.i("Set custom02 dimension value: "+e)},n.setCustomDimension03=function(e){n.instance.currentCustomDimension03=e,s.setItem(n.Dimension03Key,e),r.i("Set custom03 dimension value: "+e)},n.setFacebookId=function(e){n.instance.facebookId=e,s.setItem(n.FacebookIdKey,e),r.i("Set facebook id: "+e)},n.setGender=function(t){n.instance.gender=isNaN(Number(e.EGAGender[t]))?e.EGAGender[t].toString().toLowerCase():e.EGAGender[e.EGAGender[t]].toString().toLowerCase(),s.setItem(n.GenderKey,n.instance.gender),r.i("Set gender: "+n.instance.gender)},n.setBirthYear=function(e){n.instance.birthYear=e,s.setItem(n.BirthYearKey,e.toString()),r.i("Set birth year: "+e)},n.incrementSessionNum=function(){var e=n.getSessionNum()+1;n.instance.sessionNum=e},n.incrementTransactionNum=function(){var e=n.getTransactionNum()+1;n.instance.transactionNum=e},n.incrementProgressionTries=function(e){var t=n.getProgressionTries(e)+1;n.instance.progressionTries[e]=t;var i={};i.progression=e,i.tries=t,s.insert(a.Progression,i,!0,"progression")},n.getProgressionTries=function(e){return e in n.instance.progressionTries?n.instance.progressionTries[e]:0},n.clearProgressionTries=function(e){e in n.instance.progressionTries&&delete n.instance.progressionTries[e];var t=[];t.push(["progression",u.Equal,e]),s.delete(a.Progression,t)},n.setKeys=function(e,t){n.instance.gameKey=e,n.instance.gameSecret=t},n.setManualSessionHandling=function(e){n.instance.useManualSessionHandling=e,r.i("Use manual session handling: "+e)},n.getEventAnnotations=function(){var e={};e.v=2,e.user_id=n.instance.identifier,e.client_ts=n.getClientTsAdjusted(),e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.manufacturer=o.deviceManufacturer,e.device=o.deviceModel,e.browser_version=o.browserVersion,e.platform=o.buildPlatform,e.session_id=n.instance.sessionId,e[n.SessionNumKey]=n.instance.sessionNum;var i=o.getConnectionType();return t.validateConnectionType(i)&&(e.connection_type=i),o.gameEngineVersion&&(e.engine_version=o.gameEngineVersion),n.instance.build&&(e.build=n.instance.build),n.instance.facebookId&&(e[n.FacebookIdKey]=n.instance.facebookId),n.instance.gender&&(e[n.GenderKey]=n.instance.gender),0!=n.instance.birthYear&&(e[n.BirthYearKey]=n.instance.birthYear),e},n.getSdkErrorEventAnnotations=function(){var e={};e.v=2,e.category=n.CategorySdkError,e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.manufacturer=o.deviceManufacturer,e.device=o.deviceModel,e.platform=o.buildPlatform;var i=o.getConnectionType();return t.validateConnectionType(i)&&(e.connection_type=i),o.gameEngineVersion&&(e.engine_version=o.gameEngineVersion),e},n.getInitAnnotations=function(){var e={};return e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.platform=o.buildPlatform,e},n.getClientTsAdjusted=function(){var e=i.timeIntervalSince1970(),r=e+n.instance.clientServerTimeOffset;return t.validateClientTs(r)?r:e},n.sessionIsStarted=function(){return 0!=n.instance.sessionStart},n.cacheIdentifier=function(){n.instance.userId?n.instance.identifier=n.instance.userId:n.instance.defaultUserId&&(n.instance.identifier=n.instance.defaultUserId)},n.ensurePersistedStates=function(){s.isStorageAvailable()&&s.load();var e=n.instance;e.setDefaultId(null!=s.getItem(n.DefaultUserIdKey)?s.getItem(n.DefaultUserIdKey):i.createGuid()),e.sessionNum=null!=s.getItem(n.SessionNumKey)?Number(s.getItem(n.SessionNumKey)):0,e.transactionNum=null!=s.getItem(n.TransactionNumKey)?Number(s.getItem(n.TransactionNumKey)):0,e.facebookId?s.setItem(n.FacebookIdKey,e.facebookId):(e.facebookId=null!=s.getItem(n.FacebookIdKey)?s.getItem(n.FacebookIdKey):"",e.facebookId),e.gender?s.setItem(n.GenderKey,e.gender):(e.gender=null!=s.getItem(n.GenderKey)?s.getItem(n.GenderKey):"",e.gender),e.birthYear&&0!=e.birthYear?s.setItem(n.BirthYearKey,e.birthYear.toString()):(e.birthYear=null!=s.getItem(n.BirthYearKey)?Number(s.getItem(n.BirthYearKey)):0,e.birthYear),e.currentCustomDimension01?s.setItem(n.Dimension01Key,e.currentCustomDimension01):(e.currentCustomDimension01=null!=s.getItem(n.Dimension01Key)?s.getItem(n.Dimension01Key):"",e.currentCustomDimension01),e.currentCustomDimension02?s.setItem(n.Dimension02Key,e.currentCustomDimension02):(e.currentCustomDimension02=null!=s.getItem(n.Dimension02Key)?s.getItem(n.Dimension02Key):"",e.currentCustomDimension02),e.currentCustomDimension03?s.setItem(n.Dimension03Key,e.currentCustomDimension03):(e.currentCustomDimension03=null!=s.getItem(n.Dimension03Key)?s.getItem(n.Dimension03Key):"",e.currentCustomDimension03);var t=null!=s.getItem(n.SdkConfigCachedKey)?s.getItem(n.SdkConfigCachedKey):"";if(t){var r=JSON.parse(i.decode64(t));r&&(e.sdkConfigCached=r)}var o=s.select(a.Progression);if(o)for(var u=0;u<o.length;++u){var c=o[u];c&&(e.progressionTries[c.progression]=c.tries)}},n.calculateServerTimeOffset=function(e){return e-i.timeIntervalSince1970()},n.validateAndFixCurrentDimensions=function(){t.validateDimension01(n.getCurrentCustomDimension01(),n.getAvailableCustomDimensions01())||n.setCustomDimension01(""),t.validateDimension02(n.getCurrentCustomDimension02(),n.getAvailableCustomDimensions02())||n.setCustomDimension02(""),t.validateDimension03(n.getCurrentCustomDimension03(),n.getAvailableCustomDimensions03())||n.setCustomDimension03("")},n}();c.CategorySdkError="sdk_error",c.instance=new c,c.DefaultUserIdKey="default_user_id",c.SessionNumKey="session_num",c.TransactionNumKey="transaction_num",c.FacebookIdKey="facebook_id",c.GenderKey="gender",c.BirthYearKey="birth_year",c.Dimension01Key="dimension01",c.Dimension02Key="dimension02",c.Dimension03Key="dimension03",c.SdkConfigCachedKey="sdk_config_cached",n.GAState=c}(e.state||(e.state={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.utilities.GAUtilities,i=e.logging.GALogger,r=function(){function e(){}return e.execute=function(n,r,s,o){if(e.countMap[r]||(e.countMap[r]=0),!(e.countMap[r]>=e.MaxCount)){var a=t.getHmac(o,s),u=new XMLHttpRequest;u.onreadystatechange=function(){if(4===u.readyState){if(!u.responseText)return;if(200!=u.status)return void i.w("sdk error failed. response code not 200. status code: "+u.status+", description: "+u.statusText+", body: "+u.responseText);e.countMap[r]=e.countMap[r]+1}},u.open("POST",n,!0),u.setRequestHeader("Content-Type","application/json"),u.setRequestHeader("Authorization",a);try{u.send(s)}catch(e){console.error(e)}}},e}();r.MaxCount=10,r.countMap={},n.SdkErrorTask=r}(e.tasks||(e.tasks={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.state.GAState,i=e.logging.GALogger,r=e.utilities.GAUtilities,s=e.validators.GAValidator,o=e.tasks.SdkErrorTask,a=function(){function e(){this.protocol="https",this.hostName="api.gameanalytics.com",this.version="v2",this.baseUrl=this.protocol+"://"+this.hostName+"/"+this.version,this.initializeUrlPath="init",this.eventsUrlPath="events",this.useGzip=!1}return e.prototype.requestInit=function(i){var r=t.getGameKey(),s=this.baseUrl+"/"+r+"/"+this.initializeUrlPath,o=t.getInitAnnotations(),a=JSON.stringify(o);if(!a)return void i(n.EGAHTTPApiResponse.JsonEncodeFailed,null);var u=this.createPayloadData(a,this.useGzip),c=[];c.push(a),e.sendRequest(s,u,c,this.useGzip,e.initRequestCallback,i)},e.prototype.sendEventsInArray=function(i,r,s){if(0!=i.length){var o=t.getGameKey(),a=this.baseUrl+"/"+o+"/"+this.eventsUrlPath,u=JSON.stringify(i);if(!u)return void s(n.EGAHTTPApiResponse.JsonEncodeFailed,null,r,i.length);var c=this.createPayloadData(u,this.useGzip),d=[];d.push(u),d.push(r),d.push(i.length.toString()),e.sendRequest(a,c,d,this.useGzip,e.sendEventInArrayRequestCallback,s)}},e.prototype.sendSdkErrorEvent=function(n){var r=t.getGameKey(),a=t.getGameSecret();if(s.validateSdkErrorEvent(r,a,n)){var u=this.baseUrl+"/"+r+"/"+this.eventsUrlPath,c="",d=t.getSdkErrorEventAnnotations(),l=e.sdkErrorTypeToString(n);d.type=l;var f=[];if(f.push(d),!(c=JSON.stringify(f)))return void i.w("sendSdkErrorEvent: JSON encoding failed.");o.execute(u,n,c,a)}},e.sendEventInArrayRequestCallback=function(t,i,r,s){void 0===s&&(s=null);var o=(s[0],s[1],s[2]),a=parseInt(s[3]),u="",c=0;u=t.responseText,c=t.status;var d=e.instance.processRequestResponse(c,t.statusText,u,"Events");if(d!=n.EGAHTTPApiResponse.Ok&&d!=n.EGAHTTPApiResponse.BadRequest)return void r(d,null,o,a);var l=u?JSON.parse(u):{};if(null==l)return void r(n.EGAHTTPApiResponse.JsonDecodeFailed,null,o,a);n.EGAHTTPApiResponse.BadRequest,r(d,l,o,a)},e.sendRequest=function(e,n,i,s,o,a){var u=new XMLHttpRequest,c=t.getGameSecret(),d=r.getHmac(c,n),l=[];l.push(d);for(var f in i)l.push(i[f]);if(u.onreadystatechange=function(){4===u.readyState&&o(u,e,a,l)},u.open("POST",e,!0),u.setRequestHeader("Content-Type","text/plain"),u.setRequestHeader("Authorization",d),s)throw new Error("gzip not supported");try{u.send(n)}catch(e){console.error(e.stack)}},e.initRequestCallback=function(t,i,r,o){void 0===o&&(o=null);var a=(o[0],o[1],""),u=0;a=t.responseText,u=t.status;var c=a?JSON.parse(a):{},d=e.instance.processRequestResponse(u,t.statusText,a,"Init");if(d!=n.EGAHTTPApiResponse.Ok&&d!=n.EGAHTTPApiResponse.BadRequest)return void r(d,null);if(null==c)return void r(n.EGAHTTPApiResponse.JsonDecodeFailed,null);if(d===n.EGAHTTPApiResponse.BadRequest)return void r(d,null);var l=s.validateAndCleanInitRequestResponse(c);if(!l)return void r(n.EGAHTTPApiResponse.BadResponse,null);r(n.EGAHTTPApiResponse.Ok,l)},e.prototype.createPayloadData=function(e,n){if(n)throw new Error("gzip not supported");return e},e.prototype.processRequestResponse=function(e,t,i,r){return i?200===e?n.EGAHTTPApiResponse.Ok:0===e||401===e?n.EGAHTTPApiResponse.Unauthorized:400===e?n.EGAHTTPApiResponse.BadRequest:500===e?n.EGAHTTPApiResponse.InternalServerError:n.EGAHTTPApiResponse.UnknownResponseCode:n.EGAHTTPApiResponse.NoResponse},e.sdkErrorTypeToString=function(e){switch(e){case n.EGASdkErrorType.Rejected:return"rejected";default:return""}},e}();a.instance=new a,n.GAHTTPApi=a}(e.http||(e.http={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.store.GAStore,i=e.store.EGAStore,r=e.store.EGAStoreArgsOperator,s=e.state.GAState,o=e.logging.GALogger,a=e.utilities.GAUtilities,u=e.http.EGAHTTPApiResponse,c=e.http.GAHTTPApi,d=e.validators.GAValidator,l=e.http.EGASdkErrorType,f=function(){function n(){}return n.addSessionStartEvent=function(){var e={};e.category=n.CategorySessionStart,s.incrementSessionNum(),t.setItem(s.SessionNumKey,s.getSessionNum().toString()),n.addDimensionsToEvent(e),n.addEventToStore(e),o.i("Add SESSION START event"),n.processEvents(n.CategorySessionStart,!1)},n.addSessionEndEvent=function(){var e=s.getSessionStart(),t=s.getClientTsAdjusted(),i=t-e;i<0&&(o.w("Session length was calculated to be less then 0. Should not be possible. Resetting to 0."),i=0);var r={};r.category=n.CategorySessionEnd,r.length=i,n.addDimensionsToEvent(r),n.addEventToStore(r),o.i("Add SESSION END event."),n.processEvents("",!1)},n.addBusinessEvent=function(e,i,r,a,u){if(void 0===u&&(u=null),!d.validateBusinessEvent(e,i,u,r,a))return void c.instance.sendSdkErrorEvent(l.Rejected);var f={};s.incrementTransactionNum(),t.setItem(s.TransactionNumKey,s.getTransactionNum().toString()),f.event_id=r+":"+a,f.category=n.CategoryBusiness,f.currency=e,f.amount=i,f[s.TransactionNumKey]=s.getTransactionNum(),u&&(f.cart_type=u),n.addDimensionsToEvent(f),o.i("Add BUSINESS event: {currency:"+e+", amount:"+i+", itemType:"+r+", itemId:"+a+", cartType:"+u+"}"),n.addEventToStore(f)},n.addResourceEvent=function(t,i,r,a,u){if(!d.validateResourceEvent(t,i,r,a,u,s.getAvailableResourceCurrencies(),s.getAvailableResourceItemTypes()))return void c.instance.sendSdkErrorEvent(l.Rejected);t===e.EGAResourceFlowType.Sink&&(r*=-1);var f={},v=n.resourceFlowTypeToString(t);f.event_id=v+":"+i+":"+a+":"+u,f.category=n.CategoryResource,f.amount=r,n.addDimensionsToEvent(f),o.i("Add RESOURCE event: {currency:"+i+", amount:"+r+", itemType:"+a+", itemId:"+u+"}"),n.addEventToStore(f)},n.addProgressionEvent=function(t,i,r,a,u,f){var v=n.progressionStatusToString(t);if(!d.validateProgressionEvent(t,i,r,a))return void c.instance.sendSdkErrorEvent(l.Rejected);var g,m={};g=r?a?i+":"+r+":"+a:i+":"+r:i,m.category=n.CategoryProgression,m.event_id=v+":"+g;var p=0;f&&t!=e.EGAProgressionStatus.Start&&(m.score=u),t===e.EGAProgressionStatus.Fail&&s.incrementProgressionTries(g),t===e.EGAProgressionStatus.Complete&&(s.incrementProgressionTries(g),p=s.getProgressionTries(g),m.attempt_num=p,s.clearProgressionTries(g)),n.addDimensionsToEvent(m),o.i("Add PROGRESSION event: {status:"+v+", progression01:"+i+", progression02:"+r+", progression03:"+a+", score:"+u+", attempt:"+p+"}"),n.addEventToStore(m)},n.addDesignEvent=function(e,t,i){if(!d.validateDesignEvent(e,t))return void c.instance.sendSdkErrorEvent(l.Rejected);var r={};r.category=n.CategoryDesign,r.event_id=e,i&&(r.value=t),o.i("Add DESIGN event: {eventId:"+e+", value:"+t+"}"),n.addEventToStore(r)},n.addErrorEvent=function(e,t){var i=n.errorSeverityToString(e);if(!d.validateErrorEvent(e,t))return void c.instance.sendSdkErrorEvent(l.Rejected);var r={};r.category=n.CategoryError,r.severity=i,r.message=t,o.i("Add ERROR event: {severity:"+i+", message:"+t+"}"),n.addEventToStore(r)},n.processEvents=function(e,s){try{var u=a.createGuid();s&&(n.cleanupEvents(),n.fixMissingSessionEndEvents());var d=[];d.push(["status",r.Equal,"new"]);var l=[];l.push(["status",r.Equal,"new"]),e&&(d.push(["category",r.Equal,e]),l.push(["category",r.Equal,e]));var f=[];f.push(["status",u]);var v=t.select(i.Events,d);if(!v||0==v.length)return void o.i("Event queue: No events to send");if(v.length>n.MaxEventCount){if(!(v=t.select(i.Events,d,!0,n.MaxEventCount)))return;var g=v[v.length-1],m=g.client_ts;if(d.push(["client_ts",r.LessOrEqual,m]),!(v=t.select(i.Events,d)))return;l.push(["client_ts",r.LessOrEqual,m])}if(o.i("Event queue: Sending "+v.length+" events."),!t.update(i.Events,f,l))return;for(var p=[],h=0;h<v.length;++h){var y=v[h],S=JSON.parse(a.decode64(y.event));0!=S.length&&p.push(S)}c.instance.sendEventsInArray(p,u,n.processEventsCallback)}catch(e){o.e("Error during ProcessEvents(): "+e.stack)}},n.processEventsCallback=function(e,s,a,c){var d=[];if(d.push(["status",r.Equal,a]),e===u.Ok)t.delete(i.Events,d),o.i("Event queue: "+c+" events sent.");else if(e===u.NoResponse){var l=[];l.push(["status","new"]),o.w("Event queue: Failed to send events to collector - Retrying next time"),t.update(i.Events,l,d)}else{if(s){var f,v=0;for(var g in s)0==v&&(f=s[g]),++v;e===u.BadRequest&&f.constructor===Array?o.w("Event queue: "+c+" events sent. "+v+" events failed GA server validation."):o.w("Event queue: Failed to send events.")}else o.w("Event queue: Failed to send events.");t.delete(i.Events,d)}n.updateSessionStore()},n.cleanupEvents=function(){t.update(i.Events,[["status","new"]])},n.fixMissingSessionEndEvents=function(){var e=[];e.push(["session_id",r.NotEqual,s.getSessionId()]);var u=t.select(i.Sessions,e);if(u&&0!=u.length){o.i(u.length+" session(s) located with missing session_end event.");for(var c=0;c<u.length;++c){var d=JSON.parse(a.decode64(u[c].event)),l=d.client_ts,f=u[c].timestamp,v=l-f;v=Math.max(0,v),d.category=n.CategorySessionEnd,d.length=v,n.addEventToStore(d)}}},n.addEventToStore=function(e){if(!s.isInitialized())return void o.w("Could not add event: SDK is not initialized");try{if(t.isStoreTooLargeForEvents()&&!a.stringMatch(e.category,/^(user|session_end|business)$/))return void o.w("Database too large. Event has been blocked.");var u=s.getEventAnnotations(),c=a.encode64(JSON.stringify(u));for(var d in e)u[d]=e[d];var l=JSON.stringify(u);o.ii("Event added to queue: "+l);var f={};f.status="new",f.category=u.category,f.session_id=u.session_id,f.client_ts=u.client_ts,f.event=a.encode64(JSON.stringify(u)),t.insert(i.Events,f),e.category==n.CategorySessionEnd?t.delete(i.Sessions,[["session_id",r.Equal,u.session_id]]):(f={},f.session_id=u.session_id,f.timestamp=s.getSessionStart(),f.event=c,t.insert(i.Sessions,f,!0,"session_id")),t.isStorageAvailable()&&t.save()}catch(d){o.e("addEventToStore: error"),o.e(d.stack)}},n.updateSessionStore=function(){if(s.sessionIsStarted()){var e={};e.session_id=s.instance.sessionId,e.timestamp=s.getSessionStart(),e.event=a.encode64(JSON.stringify(s.getEventAnnotations())),t.insert(i.Sessions,e,!0,"session_id"),t.isStorageAvailable()&&t.save()}},n.addDimensionsToEvent=function(e){e&&(s.getCurrentCustomDimension01()&&(e.custom_01=s.getCurrentCustomDimension01()),s.getCurrentCustomDimension02()&&(e.custom_02=s.getCurrentCustomDimension02()),s.getCurrentCustomDimension03()&&(e.custom_03=s.getCurrentCustomDimension03()))},n.resourceFlowTypeToString=function(n){return n==e.EGAResourceFlowType.Source||n==e.EGAResourceFlowType[e.EGAResourceFlowType.Source]?"Source":n==e.EGAResourceFlowType.Sink||n==e.EGAResourceFlowType[e.EGAResourceFlowType.Sink]?"Sink":""},n.progressionStatusToString=function(n){return n==e.EGAProgressionStatus.Start||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Start]?"Start":n==e.EGAProgressionStatus.Complete||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Complete]?"Complete":n==e.EGAProgressionStatus.Fail||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Fail]?"Fail":""},n.errorSeverityToString=function(n){return n==e.EGAErrorSeverity.Debug||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Debug]?"debug":n==e.EGAErrorSeverity.Info||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Info]?"info":n==e.EGAErrorSeverity.Warning||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Warning]?"warning":n==e.EGAErrorSeverity.Error||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Error]?"error":n==e.EGAErrorSeverity.Critical||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Critical]?"critical":""},n}();f.instance=new f,f.CategorySessionStart="user",f.CategorySessionEnd="session_end",f.CategoryDesign="design",f.CategoryBusiness="business",f.CategoryProgression="progression",f.CategoryResource="resource",f.CategoryError="error",f.MaxEventCount=500,n.GAEvents=f}(e.events||(e.events={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){!function(n){var t=e.logging.GALogger,i=e.state.GAState,r=e.events.GAEvents,s=function(){function e(){this.blocks=new n.PriorityQueue({compare:function(e,n){return e-n}}),this.id2TimedBlockMap={},e.startThread()}return e.createTimedBlock=function(e){void 0===e&&(e=0);var t=new Date;return t.setSeconds(t.getSeconds()+e),new n.TimedBlock(t)},e.performTaskOnGAThread=function(t,i){void 0===i&&(i=0);var r=new Date;r.setSeconds(r.getSeconds()+i);var s=new n.TimedBlock(r);s.block=t,e.instance.id2TimedBlockMap[s.id]=s,e.instance.addTimedBlock(s)},e.performTimedBlockOnGAThread=function(n){e.instance.id2TimedBlockMap[n.id]=n,e.instance.addTimedBlock(n)},e.scheduleTimer=function(t,i){var r=new Date;r.setSeconds(r.getSeconds()+t);var s=new n.TimedBlock(r);return s.block=i,e.instance.id2TimedBlockMap[s.id]=s,e.instance.addTimedBlock(s),s.id},e.getTimedBlockById=function(n){return n in e.instance.id2TimedBlockMap?e.instance.id2TimedBlockMap[n]:null},e.ensureEventQueueIsRunning=function(){e.instance.keepRunning=!0,e.instance.isRunning||(e.instance.isRunning=!0,e.scheduleTimer(e.ProcessEventsIntervalInSeconds,e.processEventQueue))},e.endSessionAndStopQueue=function(){i.isInitialized()&&(t.i("Ending session."),e.stopEventQueue(),i.isEnabled()&&i.sessionIsStarted()&&(r.addSessionEndEvent(),i.instance.sessionStart=0))},e.stopEventQueue=function(){e.instance.keepRunning=!1},e.ignoreTimer=function(n){n in e.instance.id2TimedBlockMap&&(e.instance.id2TimedBlockMap[n].ignore=!0)},e.setEventProcessInterval=function(n){n>0&&(e.ProcessEventsIntervalInSeconds=n)},e.prototype.addTimedBlock=function(e){this.blocks.enqueue(e.deadline.getTime(),e)},e.run=function(){clearTimeout(e.runTimeoutId);try{for(var n;n=e.getNextBlock();)if(!n.ignore)if(n.async){if(!n.running){n.running=!0,n.block();break}}else n.block();return void(e.runTimeoutId=setTimeout(e.run,e.ThreadWaitTimeInMs))}catch(e){t.e("Error on GA thread"),t.e(e.stack)}},e.startThread=function(){e.runTimeoutId=setTimeout(e.run,0)},e.getNextBlock=function(){var n=new Date;return e.instance.blocks.hasItems()&&e.instance.blocks.peek().deadline.getTime()<=n.getTime()?e.instance.blocks.peek().async&&e.instance.blocks.peek().running?e.instance.blocks.peek():e.instance.blocks.dequeue():null},e.processEventQueue=function(){r.processEvents("",!0),e.instance.keepRunning?e.scheduleTimer(e.ProcessEventsIntervalInSeconds,e.processEventQueue):e.instance.isRunning=!1},e}();s.instance=new s,s.ThreadWaitTimeInMs=1e3,s.ProcessEventsIntervalInSeconds=8,n.GAThreading=s}(e.threading||(e.threading={}))}(gameanalytics||(gameanalytics={}));var gameanalytics;!function(e){var n=e.threading.GAThreading,t=e.logging.GALogger,i=e.store.GAStore,r=e.state.GAState,s=e.http.GAHTTPApi,o=e.device.GADevice,a=e.validators.GAValidator,u=e.http.EGAHTTPApiResponse,c=e.utilities.GAUtilities,d=e.events.GAEvents,l=function(){function l(){}return l.init=function(){if(o.touch(),l.methodMap.configureAvailableCustomDimensions01=l.configureAvailableCustomDimensions01,l.methodMap.configureAvailableCustomDimensions02=l.configureAvailableCustomDimensions02,l.methodMap.configureAvailableCustomDimensions03=l.configureAvailableCustomDimensions03,l.methodMap.configureAvailableResourceCurrencies=l.configureAvailableResourceCurrencies,l.methodMap.configureAvailableResourceItemTypes=l.configureAvailableResourceItemTypes,l.methodMap.configureBuild=l.configureBuild,l.methodMap.configureSdkGameEngineVersion=l.configureSdkGameEngineVersion,l.methodMap.configureGameEngineVersion=l.configureGameEngineVersion,l.methodMap.configureUserId=l.configureUserId,l.methodMap.initialize=l.initialize,l.methodMap.addBusinessEvent=l.addBusinessEvent,l.methodMap.addResourceEvent=l.addResourceEvent,l.methodMap.addProgressionEvent=l.addProgressionEvent,l.methodMap.addDesignEvent=l.addDesignEvent,l.methodMap.addErrorEvent=l.addErrorEvent,l.methodMap.addErrorEvent=l.addErrorEvent,l.methodMap.setEnabledInfoLog=l.setEnabledInfoLog,l.methodMap.setEnabledVerboseLog=l.setEnabledVerboseLog,l.methodMap.setEnabledManualSessionHandling=l.setEnabledManualSessionHandling,l.methodMap.setCustomDimension01=l.setCustomDimension01,l.methodMap.setCustomDimension02=l.setCustomDimension02,l.methodMap.setCustomDimension03=l.setCustomDimension03,l.methodMap.setFacebookId=l.setFacebookId,l.methodMap.setGender=l.setGender,l.methodMap.setBirthYear=l.setBirthYear,l.methodMap.setEventProcessInterval=l.setEventProcessInterval,l.methodMap.startSession=l.startSession,l.methodMap.endSession=l.endSession,l.methodMap.onStop=l.onStop,l.methodMap.onResume=l.onResume,"undefined"!=typeof window&&void 0!==window.GameAnalytics&&void 0!==window.GameAnalytics.q){var e=window.GameAnalytics.q;for(var n in e)l.gaCommand.apply(null,e[n])}},l.gaCommand=function(){for(var n=[],t=0;t<arguments.length;t++)n[t]=arguments[t];n.length>0&&n[0]in e.GameAnalytics.methodMap&&(n.length>1?e.GameAnalytics.methodMap[n[0]].apply(null,Array.prototype.slice.call(n,1)):e.GameAnalytics.methodMap[n[0]]())},l.configureAvailableCustomDimensions01=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions01(e)})},l.configureAvailableCustomDimensions02=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions02(e)})},l.configureAvailableCustomDimensions03=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions03(e)})},l.configureAvailableResourceCurrencies=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available resource currencies must be set before SDK is initialized");r.setAvailableResourceCurrencies(e)})},l.configureAvailableResourceItemTypes=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available resource item types must be set before SDK is initialized");r.setAvailableResourceItemTypes(e)})},l.configureBuild=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){return l.isSdkReady(!0,!1)?void t.w("Build version must be set before SDK is initialized."):a.validateBuild(e)?void r.setBuild(e):void t.i("Validation fail - configure build: Cannot be null, empty or above 32 length. String: "+e)})},l.configureSdkGameEngineVersion=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!l.isSdkReady(!0,!1))return a.validateSdkWrapperVersion(e)?void(o.sdkGameEngineVersion=e):void t.i("Validation fail - configure sdk version: Sdk version not supported. String: "+e)})},l.configureGameEngineVersion=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!l.isSdkReady(!0,!1))return a.validateEngineVersion(e)?void(o.gameEngineVersion=e):void t.i("Validation fail - configure game engine version: Game engine version not supported. String: "+e)})},l.configureUserId=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){return l.isSdkReady(!0,!1)?void t.w("A custom user id must be set before SDK is initialized."):a.validateUserId(e)?void r.setUserId(e):void t.i("Validation fail - configure user_id: Cannot be null, empty or above 64 length. Will use default user_id method. Used string: "+e)})},l.initialize=function(e,i){void 0===e&&(e=""),void 0===i&&(i=""),o.updateConnectionType();var s=n.createTimedBlock();s.async=!0,l.initTimedBlockId=s.id,s.block=function(){return l.isSdkReady(!0,!1)?void t.w("SDK already initialized. Can only be called once."):a.validateKeys(e,i)?(r.setKeys(e,i),void l.internalInitialize()):void t.w("SDK failed initialize. Game key or secret key is invalid. Can only contain characters A-z 0-9, gameKey is 32 length, gameSecret is 40 length. Failed keys - gameKey: "+e+", secretKey: "+i)},n.performTimedBlockOnGAThread(s)},l.addBusinessEvent=function(e,t,i,r,s){void 0===e&&(e=""),void 0===t&&(t=0),void 0===i&&(i=""),void 0===r&&(r=""),void 0===s&&(s=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add business event")&&d.addBusinessEvent(e,t,i,r,s)})},l.addResourceEvent=function(t,i,r,s,a){void 0===t&&(t=e.EGAResourceFlowType.Undefined),void 0===i&&(i=""),void 0===r&&(r=0),void 0===s&&(s=""),void 0===a&&(a=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add resource event")&&d.addResourceEvent(t,i,r,s,a)})},l.addProgressionEvent=function(t,i,r,s,a){void 0===t&&(t=e.EGAProgressionStatus.Undefined),void 0===i&&(i=""),void 0===r&&(r=""),void 0===s&&(s=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!0,"Could not add progression event")){var e=void 0!==a;d.addProgressionEvent(t,i,r,s,e?a:0,e)}})},l.addDesignEvent=function(e,t){o.updateConnectionType(),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!0,"Could not add design event")){var n=void 0!==t;d.addDesignEvent(e,n?t:0,n)}})},l.addErrorEvent=function(t,i){void 0===t&&(t=e.EGAErrorSeverity.Undefined),void 0===i&&(i=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add error event")&&d.addErrorEvent(t,i)})},l.setEnabledInfoLog=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){e?(t.setInfoLog(e),t.i("Info logging enabled")):(t.i("Info logging disabled"),t.setInfoLog(e))})},l.setEnabledVerboseLog=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){e?(t.setVerboseLog(e),t.i("Verbose logging enabled")):(t.i("Verbose logging disabled"),t.setVerboseLog(e))})},l.setEnabledManualSessionHandling=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){r.setManualSessionHandling(e)})},l.setCustomDimension01=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension01(e,r.getAvailableCustomDimensions01()))return void t.w("Could not set custom01 dimension value to '"+e+"'. Value not found in available custom01 dimension values");r.setCustomDimension01(e)})},l.setCustomDimension02=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension02(e,r.getAvailableCustomDimensions02()))return void t.w("Could not set custom02 dimension value to '"+e+"'. Value not found in available custom02 dimension values");r.setCustomDimension02(e)})},l.setCustomDimension03=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension03(e,r.getAvailableCustomDimensions03()))return void t.w("Could not set custom03 dimension value to '"+e+"'. Value not found in available custom03 dimension values");r.setCustomDimension03(e)})},l.setFacebookId=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){a.validateFacebookId(e)&&r.setFacebookId(e)})},l.setGender=function(t){void 0===t&&(t=e.EGAGender.Undefined),n.performTaskOnGAThread(function(){a.validateGender(t)&&r.setGender(t)})},l.setBirthYear=function(e){void 0===e&&(e=0),n.performTaskOnGAThread(function(){a.validateBirthyear(e)&&r.setBirthYear(e)})},l.setEventProcessInterval=function(e){n.performTaskOnGAThread(function(){n.setEventProcessInterval(e)})},l.startSession=function(){if(r.getUseManualSessionHandling()){if(!r.isInitialized())return;var e=n.createTimedBlock();e.async=!0,l.initTimedBlockId=e.id,e.block=function(){r.isEnabled()&&r.sessionIsStarted()&&n.endSessionAndStopQueue(),l.resumeSessionAndStartQueue()},n.performTimedBlockOnGAThread(e)}},l.endSession=function(){r.getUseManualSessionHandling()&&l.onStop()},l.onStop=function(){n.performTaskOnGAThread(function(){try{n.endSessionAndStopQueue()}catch(e){}})},l.onResume=function(){var e=n.createTimedBlock();e.async=!0,l.initTimedBlockId=e.id,e.block=function(){l.resumeSessionAndStartQueue()},n.performTimedBlockOnGAThread(e)},l.internalInitialize=function(){r.ensurePersistedStates(),i.setItem(r.DefaultUserIdKey,r.getDefaultId()),r.setInitialized(!0),l.newSession(),r.isEnabled()&&n.ensureEventQueueIsRunning()},l.newSession=function(){t.i("Starting a new session."),r.validateAndFixCurrentDimensions(),s.instance.requestInit(l.startNewSessionCallback)},l.startNewSessionCallback=function(e,s){if(e===u.Ok&&s){var o=0;if(s.server_ts){var a=s.server_ts;o=r.calculateServerTimeOffset(a)}s.time_offset=o,i.setItem(r.SdkConfigCachedKey,c.encode64(JSON.stringify(s))),r.instance.sdkConfigCached=s,r.instance.sdkConfig=s,r.instance.initAuthorized=!0}else e==u.Unauthorized?(t.w("Initialize SDK failed - Unauthorized"),r.instance.initAuthorized=!1):(e===u.NoResponse||e===u.RequestTimeout?t.i("Init call (session start) failed - no response. Could be offline or timeout."):e===u.BadResponse||e===u.JsonEncodeFailed||e===u.JsonDecodeFailed?t.i("Init call (session start) failed - bad response. Could be bad response from proxy or GA servers."):e!==u.BadRequest&&e!==u.UnknownResponseCode||t.i("Init call (session start) failed - bad request or unknown response."),null==r.instance.sdkConfig?null!=r.instance.sdkConfigCached?(t.i("Init call (session start) failed - using cached init values."),r.instance.sdkConfig=r.instance.sdkConfigCached):(t.i("Init call (session start) failed - using default init values."),r.instance.sdkConfig=r.instance.sdkConfigDefault):t.i("Init call (session start) failed - using cached init values."),r.instance.initAuthorized=!0)
;if(r.instance.clientServerTimeOffset=r.instance.sdkConfig.time_offset?r.instance.sdkConfig.time_offset:0,!r.isEnabled())return t.w("Could not start session: SDK is disabled."),void n.stopEventQueue();n.ensureEventQueueIsRunning();var f=c.createGuid();r.instance.sessionId=f,r.instance.sessionStart=r.getClientTsAdjusted(),d.addSessionStartEvent(),n.getTimedBlockById(l.initTimedBlockId).running=!1,l.initTimedBlockId=-1},l.resumeSessionAndStartQueue=function(){r.isInitialized()&&(t.i("Resuming session."),r.sessionIsStarted()||l.newSession())},l.isSdkReady=function(e,n,i){return void 0===n&&(n=!0),void 0===i&&(i=""),i&&(i+=": "),e&&!r.isInitialized()?(n&&t.w(i+"SDK is not initialized"),!1):!(e&&!r.isEnabled())||(n&&t.w(i+"SDK is disabled"),!1)},l}();l.initTimedBlockId=-1,l.methodMap={},e.GameAnalytics=l}(gameanalytics||(gameanalytics={})),gameanalytics.GameAnalytics.init();var GameAnalytics=gameanalytics.GameAnalytics.gaCommand;
scope.gameanalytics=gameanalytics;
scope.GameAnalytics=GameAnalytics;
})(this);
/* global define, module, require */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['crypto-js', 'ws'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Export.
        module.exports = factory(require('crypto-js'), require('ws'));
    } else {
        // Browser globals (root is window)
        root.GameSparks = factory(root.Crypto, root.WebSocket || root.MozWebSocket);
    }
}(this, function(CryptoJS, WebSocket) {

    var GameSparks = function() {};

    GameSparks.prototype = {

        init: function(options) {
            this.options = options;
            this.socketUrl = options.url;

            this.pendingRequests = {};
            this.requestCounter = 0;

            this.connect();
        },

        initPreview: function(options) {
            options.url = 'wss://preview.gamesparks.net/ws/' + options.key;
            this.init(options);
        },

        initLive: function(options) {
            options.url = 'wss://service.gamesparks.net/ws/' + options.key;
            this.init(options);
        },

        reset: function() {
            this.initialised = false;
            this.connected = false;
            this.error = false;
            this.disconnected = false;

            if (this.webSocket != null){
                this.webSocket.onclose = null;
                this.webSocket.close();
            }
        },

        connect: function() {
            this.reset();

            try {
                this.webSocket = new WebSocket(this.socketUrl);
                this.webSocket.onopen = this.onWebSocketOpen.bind(this);
                this.webSocket.onclose = this.onWebSocketClose.bind(this);
                this.webSocket.onerror = this.onWebSocketError.bind(this);
                this.webSocket.onmessage = this.onWebSocketMessage.bind(this);
            } catch(e) {
                this.log(e.message);
            }
        },

        disconnect: function() {
            if (this.webSocket && this.connected) {
                this.disconnected = true;
                this.webSocket.close();
            }
        },

        onWebSocketOpen: function(ev) {
            this.log('WebSocket onOpen');

            if (this.options.onOpen) {
                this.options.onOpen(ev);
            }

            this.connected = true;
        },

        onWebSocketClose: function(ev) {
            this.log('WebSocket onClose');

            if (this.options.onClose) {
                this.options.onClose(ev);
            }

            this.connected = false;

            // Attemp a re-connection if not in error state or deliberately disconnected.
            if (!this.error && !this.disconnected) {
                this.connect();
            }
        },

        onWebSocketError: function(ev) {

            this.log('WebSocket onError: Sorry, but there is some problem with your socket or the server is down');

            if (this.options.onError) {
                this.options.onError(ev);
            }

            // Reset the socketUrl to the original.
            this.socketUrl = this.options.url;

            this.error = true;
        },

        onWebSocketMessage: function(message) {
            this.log('WebSocket onMessage: ' + message.data);

            var result;
            try {
                result = JSON.parse(message.data);
            } catch (e) {
                this.log('An error ocurred while parsing the JSON Data: ' + message + '; Error: ' + e);
                return;
            }

            if (this.options.onMessage) {
                this.options.onMessage(result);
            }

            // Extract any auth token.
            if (result['authToken']) {
                this.authToken = result['authToken'];
                delete result['authToken'];
            }

            if (result['connectUrl']) {
                // Any time a connectUrl is in the response we should update and reconnect.
                this.socketUrl = result['connectUrl'];
                this.connect();
            }

            var resultType = result['@class'];

            if (resultType === '.AuthenticatedConnectResponse') {
                this.handshake(result);
            } else if (resultType.match(/Response$/)){
                if (result['requestId']) {
                    var requestId = result['requestId'];
                    delete result['requestId'];

                    if (this.pendingRequests[requestId]) {
                        this.pendingRequests[requestId](result);
                        this.pendingRequests[requestId] = null;
                    }
                }
            }

        },

        handshake: function(result) {

            if (result['nonce']) {

                var hmac;

                if (this.options["onNonce"]) {
                    hmac = this.options.onNonce(result['nonce']);
                } else {
                    hmac = window.Crypto.enc.Base64.stringify(window.Crypto.HmacSHA256(result['nonce'], this.options.secret));
                }

                var toSend = {
                    '@class' : '.AuthenticatedConnectRequest',
                    hmac : hmac
                };

                if (this.authToken) {
                    toSend.authToken = this.authToken;
                }

                if (this.sessionId) {
                    toSend.sessionId = this.sessionId;
                }

                const browserData = this.getBrowserData();
                toSend.platform = browserData.browser;
                toSend.os = browserData.operatingSystem;

                this.webSocketSend(toSend);

            } else if (result['sessionId']) {
                this.sessionId = result['sessionId'];
                this.initialised = true;

                if (this.options.onInit) {
                    this.options.onInit();
                }

                this.keepAliveInterval = window.setInterval(this.keepAlive.bind(this), 30000);
            }
        },

        keepAlive: function() {
            if (this.initialised && this.connected) {
                this.webSocket.send(' ');
            }
        },

        send: function(requestType, onResponse){
            this.sendWithData(requestType, {}, onResponse);
        },

        sendWithData: function(requestType, json, onResponse) {
            if (!this.initialised) {
                onResponse({ error: 'NOT_INITIALISED' });
                return;
            }

            // Ensure requestType starts with a dot.
            if (requestType.indexOf('.') !== 0) {
                requestType = '.' + requestType;
            }

            json['@class'] = requestType;

            json.requestId = (new Date()).getTime() + "_" + (++this.requestCounter);

            if (onResponse != null) {
                this.pendingRequests[json.requestId] = onResponse;
                // Time out handler.
                setTimeout((function() {
                    if (this.pendingRequests[json.requestId]) {
                        this.pendingRequests[json.requestId]({ error: 'NO_RESPONSE' });
                    }
                }).bind(this), 32000);
            }

            this.webSocketSend(json);
        },

        webSocketSend: function(data) {

            if (this.options.onSend) {
                this.options.onSend(data);
            }

            var requestString = JSON.stringify(data);
            this.log('WebSocket send: ' + requestString);
            this.webSocket.send(requestString);
        },

        getSocketUrl: function() {
            return this.socketUrl;
        },

        getSessionId: function() {
            return this.sessionId;
        },

        getAuthToken: function() {
            return this.authToken;
        },

        setAuthToken: function(authToken) {
            this.authToken = authToken;
        },

        isConnected: function() {
            return this.connected;
        },

        log: function(message) {
            if (this.options.logger) {
                this.options.logger(message);
            }
        },

        getBrowserData: function() {

            var browsers = [
                {
                    string: navigator.userAgent,
                    subString: 'Chrome',
                    identity: 'Chrome'
                },
                {   string: navigator.userAgent,
                    subString: 'OmniWeb',
                    versionSearch: 'OmniWeb/',
                    identity: 'OmniWeb'
                },
                {
                    string: navigator.vendor,
                    subString: 'Apple',
                    identity: 'Safari',
                    versionSearch: 'Version'
                },
                {
                    prop: window.opera,
                    identity: 'Opera',
                    versionSearch: 'Version'
                },
                {
                    string: navigator.vendor,
                    subString: 'iCab',
                    identity: 'iCab'
                },
                {
                    string: navigator.vendor,
                    subString: 'KDE',
                    identity: 'Konqueror'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Firefox',
                    identity: 'Firefox'
                },
                {
                    string: navigator.vendor,
                    subString: 'Camino',
                    identity: 'Camino'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Netscape',
                    identity: 'Netscape'
                },
                {
                    string: navigator.userAgent,
                    subString: 'MSIE',
                    identity: 'Explorer',
                    versionSearch: 'MSIE'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Gecko',
                    identity: 'Mozilla',
                    versionSearch: 'rv'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Mozilla',
                    identity: 'Netscape',
                    versionSearch: 'Mozilla'
                }
            ];

            var operatingSystems = [
                {
                    string: navigator.platform,
                    subString: 'Win',
                    identity: 'Windows'
                },
                {
                    string: navigator.platform,
                    subString: 'Mac',
                    identity: 'Mac'
                },
                {
                    string: navigator.userAgent,
                    subString: 'iPhone',
                    identity: 'iPhone/iPod'
                },
                {
                    string: navigator.platform,
                    subString: 'Linux',
                    identity: 'Linux'
                }
            ];

            function searchForIdentity(data) {
                for (var i = 0; i < data.length; i++) {
                    var string = data[i].string;
                    var prop = data[i].prop;

                    if (string) {
                        // Look for the sub string in the string.
                        if (string.indexOf(data[i].subString) !== -1) {
                            return data[i].identity;
                        }
                    } else if (prop) {
                        return data[i].identity;
                    }
                }
            }

            return {
                browser: searchForIdentity(browsers),
                operatingSystem: searchForIdentity(operatingSystems)
            };
        }
    };

    return GameSparks;

}));

//var GameSparks = function() {};
GameSparks.prototype.acceptChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("AcceptChallengeRequest", request, onResponse);
}
GameSparks.prototype.accountDetailsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("AccountDetailsRequest", request, onResponse);
}
GameSparks.prototype.analyticsRequest = function(data, end, key, start, onResponse )
{
    var request = {};
    request["data"] = data;
    request["end"] = end;
    request["key"] = key;
    request["start"] = start;
    gamesparks.sendWithData("AnalyticsRequest", request, onResponse);
}
GameSparks.prototype.aroundMeLeaderboardRequest = function(count, friendIds, leaderboardShortCode, social, onResponse )
{
    var request = {};
    request["count"] = count;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["social"] = social;
    gamesparks.sendWithData("AroundMeLeaderboardRequest", request, onResponse);
}
GameSparks.prototype.authenticationRequest = function(password, userName, onResponse )
{
    var request = {};
    request["password"] = password;
    request["userName"] = userName;
    gamesparks.sendWithData("AuthenticationRequest", request, onResponse);
}
GameSparks.prototype.buyVirtualGoodsRequest = function(currencyType, quantity, shortCode, onResponse )
{
    var request = {};
    request["currencyType"] = currencyType;
    request["quantity"] = quantity;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("BuyVirtualGoodsRequest", request, onResponse);
}
GameSparks.prototype.changeUserDetailsRequest = function(displayName, onResponse )
{
    var request = {};
    request["displayName"] = displayName;
    gamesparks.sendWithData("ChangeUserDetailsRequest", request, onResponse);
}
GameSparks.prototype.chatOnChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("ChatOnChallengeRequest", request, onResponse);
}
GameSparks.prototype.consumeVirtualGoodRequest = function(quantity, shortCode, onResponse )
{
    var request = {};
    request["quantity"] = quantity;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("ConsumeVirtualGoodRequest", request, onResponse);
}
GameSparks.prototype.createChallengeRequest = function(accessType, challengeMessage, challengeShortCode, currency1Wager, currency2Wager, currency3Wager, currency4Wager, currency5Wager, currency6Wager, endTime, expiryTime, maxAttempts, maxPlayers, minPlayers, silent, startTime, usersToChallenge, onResponse )
{
    var request = {};
    request["accessType"] = accessType;
    request["challengeMessage"] = challengeMessage;
    request["challengeShortCode"] = challengeShortCode;
    request["currency1Wager"] = currency1Wager;
    request["currency2Wager"] = currency2Wager;
    request["currency3Wager"] = currency3Wager;
    request["currency4Wager"] = currency4Wager;
    request["currency5Wager"] = currency5Wager;
    request["currency6Wager"] = currency6Wager;
    request["endTime"] = endTime;
    request["expiryTime"] = expiryTime;
    request["maxAttempts"] = maxAttempts;
    request["maxPlayers"] = maxPlayers;
    request["minPlayers"] = minPlayers;
    request["silent"] = silent;
    request["startTime"] = startTime;
    request["usersToChallenge"] = usersToChallenge;
    gamesparks.sendWithData("CreateChallengeRequest", request, onResponse);
}
GameSparks.prototype.declineChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("DeclineChallengeRequest", request, onResponse);
}
GameSparks.prototype.deviceAuthenticationRequest = function(deviceId, deviceModel, deviceName, deviceOS, deviceType, operatingSystem, onResponse )
{
    var request = {};
    request["deviceId"] = deviceId;
    request["deviceModel"] = deviceModel;
    request["deviceName"] = deviceName;
    request["deviceOS"] = deviceOS;
    request["deviceType"] = deviceType;
    request["operatingSystem"] = operatingSystem;
    gamesparks.sendWithData("DeviceAuthenticationRequest", request, onResponse);
}
GameSparks.prototype.dismissMessageRequest = function(messageId, onResponse )
{
    var request = {};
    request["messageId"] = messageId;
    gamesparks.sendWithData("DismissMessageRequest", request, onResponse);
}
GameSparks.prototype.endSessionRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("EndSessionRequest", request, onResponse);
}
GameSparks.prototype.facebookConnectRequest = function(accessToken, code, onResponse )
{
    var request = {};
    request["accessToken"] = accessToken;
    request["code"] = code;
    gamesparks.sendWithData("FacebookConnectRequest", request, onResponse);
}
GameSparks.prototype.findChallengeRequest = function(accessType, count, offset, onResponse )
{
    var request = {};
    request["accessType"] = accessType;
    request["count"] = count;
    request["offset"] = offset;
    gamesparks.sendWithData("FindChallengeRequest", request, onResponse);
}
GameSparks.prototype.getChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("GetChallengeRequest", request, onResponse);
}
GameSparks.prototype.getDownloadableRequest = function(shortCode, onResponse )
{
    var request = {};
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("GetDownloadableRequest", request, onResponse);
}
GameSparks.prototype.getMessageRequest = function(messageId, onResponse )
{
    var request = {};
    request["messageId"] = messageId;
    gamesparks.sendWithData("GetMessageRequest", request, onResponse);
}
GameSparks.prototype.getRunningTotalsRequest = function(friendIds, shortCode, onResponse )
{
    var request = {};
    request["friendIds"] = friendIds;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("GetRunningTotalsRequest", request, onResponse);
}
GameSparks.prototype.getUploadUrlRequest = function(uploadData, onResponse )
{
    var request = {};
    request["uploadData"] = uploadData;
    gamesparks.sendWithData("GetUploadUrlRequest", request, onResponse);
}
GameSparks.prototype.getUploadedRequest = function(uploadId, onResponse )
{
    var request = {};
    request["uploadId"] = uploadId;
    gamesparks.sendWithData("GetUploadedRequest", request, onResponse);
}
GameSparks.prototype.googlePlayBuyGoodsRequest = function(currencyCode, signature, signedData, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["signature"] = signature;
    request["signedData"] = signedData;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("GooglePlayBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.iOSBuyGoodsRequest = function(currencyCode, receipt, sandbox, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["receipt"] = receipt;
    request["sandbox"] = sandbox;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("IOSBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.joinChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("JoinChallengeRequest", request, onResponse);
}
GameSparks.prototype.leaderboardDataRequest = function(challengeInstanceId, entryCount, friendIds, leaderboardShortCode, offset, social, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["entryCount"] = entryCount;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["offset"] = offset;
    request["social"] = social;
    gamesparks.sendWithData("LeaderboardDataRequest", request, onResponse);
}
GameSparks.prototype.listAchievementsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListAchievementsRequest", request, onResponse);
}
GameSparks.prototype.listChallengeRequest = function(entryCount, offset, shortCode, state, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    request["shortCode"] = shortCode;
    request["state"] = state;
    gamesparks.sendWithData("ListChallengeRequest", request, onResponse);
}
GameSparks.prototype.listChallengeTypeRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListChallengeTypeRequest", request, onResponse);
}
GameSparks.prototype.listGameFriendsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListGameFriendsRequest", request, onResponse);
}
GameSparks.prototype.listInviteFriendsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListInviteFriendsRequest", request, onResponse);
}
GameSparks.prototype.listLeaderboardsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListLeaderboardsRequest", request, onResponse);
}
GameSparks.prototype.listMessageRequest = function(entryCount, offset, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    gamesparks.sendWithData("ListMessageRequest", request, onResponse);
}
GameSparks.prototype.listMessageSummaryRequest = function(entryCount, offset, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    gamesparks.sendWithData("ListMessageSummaryRequest", request, onResponse);
}
GameSparks.prototype.listVirtualGoodsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListVirtualGoodsRequest", request, onResponse);
}
GameSparks.prototype.logChallengeEventRequest = function(challengeInstanceId, eventKey, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["eventKey"] = eventKey;
    gamesparks.sendWithData("LogChallengeEventRequest", request, onResponse);
}
GameSparks.prototype.logEventRequest = function(eventKey, onResponse )
{
    var request = {};
    request["eventKey"] = eventKey;
    gamesparks.sendWithData("LogEventRequest", request, onResponse);
}
GameSparks.prototype.pushRegistrationRequest = function(deviceOS, pushId, onResponse )
{
    var request = {};
    request["deviceOS"] = deviceOS;
    request["pushId"] = pushId;
    gamesparks.sendWithData("PushRegistrationRequest", request, onResponse);
}
GameSparks.prototype.registrationRequest = function(displayName, password, userName, onResponse )
{
    var request = {};
    request["displayName"] = displayName;
    request["password"] = password;
    request["userName"] = userName;
    gamesparks.sendWithData("RegistrationRequest", request, onResponse);
}
GameSparks.prototype.sendFriendMessageRequest = function(friendIds, message, onResponse )
{
    var request = {};
    request["friendIds"] = friendIds;
    request["message"] = message;
    gamesparks.sendWithData("SendFriendMessageRequest", request, onResponse);
}
GameSparks.prototype.socialLeaderboardDataRequest = function(challengeInstanceId, entryCount, friendIds, leaderboardShortCode, offset, social, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["entryCount"] = entryCount;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["offset"] = offset;
    request["social"] = social;
    gamesparks.sendWithData("SocialLeaderboardDataRequest", request, onResponse);
}
GameSparks.prototype.twitterConnectRequest = function(accessSecret, accessToken, onResponse )
{
    var request = {};
    request["accessSecret"] = accessSecret;
    request["accessToken"] = accessToken;
    gamesparks.sendWithData("TwitterConnectRequest", request, onResponse);
}
GameSparks.prototype.windowsBuyGoodsRequest = function(currencyCode, receipt, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["receipt"] = receipt;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("WindowsBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.withdrawChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("WithdrawChallengeRequest", request, onResponse);
}
var e,aa=document.getElementById("canvasBackground"),ba="game_solitaire theme_classic big gameui_difficulty endscreen_difficulty landscape final poki_api".split(" ");function f(a,b){var c=a.userAgent.match(b);return c&&1<c.length&&c[1]||""}
var m=new function(){this.userAgent=void 0;void 0===this.userAgent&&(this.userAgent=void 0!==navigator?navigator.userAgent:"");var a=f(this,/(ipod|iphone|ipad)/i).toLowerCase(),b=!/like android/i.test(this.userAgent)&&/android/i.test(this.userAgent),c=f(this,/version\/(\d+(\.\d+)?)/i),d=/tablet/i.test(this.userAgent),g=!d&&/[^-]mobi/i.test(this.userAgent);this.t={};this.La={};this.ff={};/opera|opr/i.test(this.userAgent)?(this.name="Opera",this.t.opera=!0,this.t.version=c||f(this,/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i)):
/windows phone/i.test(this.userAgent)?(this.name="Windows Phone",this.La.Xo=!0,this.t.Bk=!0,this.t.version=f(this,/iemobile\/(\d+(\.\d+)?)/i)):/msie|trident/i.test(this.userAgent)?(this.name="Internet Explorer",this.t.Bk=!0,this.t.version=f(this,/(?:msie |rv:)(\d+(\.\d+)?)/i)):/Edge/i.test(this.userAgent)?(this.name="Microsoft Edge",this.t.Bm=!0,this.t.version=f(this,/(?:msie |rv:)(\d+(\.\d+)?)/i)):/chrome|crios|crmo/i.test(this.userAgent)?(this.name="Chrome",this.t.chrome=!0,this.t.version=f(this,
/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)):a?(this.name="iphone"==a?"iPhone":"ipad"==a?"iPad":"iPod",c&&(this.t.version=c)):/sailfish/i.test(this.userAgent)?(this.name="Sailfish",this.t.qA=!0,this.t.version=f(this,/sailfish\s?browser\/(\d+(\.\d+)?)/i)):/seamonkey\//i.test(this.userAgent)?(this.name="SeaMonkey",this.t.FA=!0,this.t.version=f(this,/seamonkey\/(\d+(\.\d+)?)/i)):/firefox|iceweasel/i.test(this.userAgent)?(this.name="Firefox",this.t.uq=!0,this.t.version=f(this,/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i),
/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(this.userAgent)&&(this.La.Uy=!0)):/silk/i.test(this.userAgent)?(this.name="Amazon Silk",this.t.ks=!0,this.t.version=f(this,/silk\/(\d+(\.\d+)?)/i)):b?(this.name="Android",this.t.Lg=!0,this.t.version=c):/phantom/i.test(this.userAgent)?(this.name="PhantomJS",this.t.Zz=!0,this.t.version=f(this,/phantomjs\/(\d+(\.\d+)?)/i)):/blackberry|\bbb\d+/i.test(this.userAgent)||/rim\stablet/i.test(this.userAgent)?(this.name="BlackBerry",this.t.Hp=!0,this.t.version=c||
f(this,/blackberry[\d]+\/(\d+(\.\d+)?)/i)):/(web|hpw)os/i.test(this.userAgent)?(this.name="WebOS",this.t.wt=!0,this.t.version=c||f(this,/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i),/touchpad\//i.test(this.userAgent)&&(this.ff.YA=!0)):/bada/i.test(this.userAgent)?(this.name="Bada",this.t.Fp=!0,this.t.version=f(this,/dolfin\/(\d+(\.\d+)?)/i)):/tizen/i.test(this.userAgent)?(this.name="Tizen",this.t.Hx=!0,this.t.version=f(this,/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i)||c):/safari/i.test(this.userAgent)&&(this.name=
"Safari",this.t.ko=!0,this.t.version=c);/(apple)?webkit/i.test(this.userAgent)?(this.name=this.name||"Webkit",this.t.dB=!0,!this.t.version&&c&&(this.t.version=c)):!this.opera&&/gecko\//i.test(this.userAgent)&&(this.name=this.name||"Gecko",this.t.$y=!0,this.t.version=this.t.version||f(this,/gecko\/(\d+(\.\d+)?)/i));b||this.ks?this.La.by=!0:a&&(this.La.hk=!0);c="";a?(c=f(this,/os (\d+([_\s]\d+)*) like mac os x/i),c=c.replace(/[_\s]/g,".")):b?c=f(this,/android[ \/-](\d+(\.\d+)*)/i):this.Xo?c=f(this,
/windows phone (?:os)?\s?(\d+(\.\d+)*)/i):this.wt?c=f(this,/(?:web|hpw)os\/(\d+(\.\d+)*)/i):this.Hp?c=f(this,/rim\stablet\sos\s(\d+(\.\d+)*)/i):this.Fp?c=f(this,/bada\/(\d+(\.\d+)*)/i):this.Hx&&(c=f(this,/tizen[\/\s](\d+(\.\d+)*)/i));c&&(this.La.version=c);c=c.split(".")[0];if(d||"ipad"==a||b&&(3==c||4==c&&!g)||this.ks)this.ff.Ls=!0;else if(g||"iphone"==a||"ipod"==a||b||this.Hp||this.wt||this.Fp)this.ff.Jr=!0;this.ne={sh:!1,Hh:!1,x:!1};this.Bk&&10<=this.t.version||this.chrome&&20<=this.t.version||
this.uq&&20<=this.t.version||this.ko&&6<=this.t.version||this.opera&&10<=this.t.version||this.hk&&this.La.version&&6<=this.La.version.split(".")[0]?this.ne.sh=!0:this.Bk&&10>this.t.version||this.chrome&&20>this.t.version||this.uq&&20>this.t.version||this.ko&&6>this.t.version||this.opera&&10>this.t.version||this.hk&&this.La.version&&6>this.La.version.split(".")[0]?this.ne.Hh=!0:this.ne.x=!0;try{this.t.Zd=this.t.version?parseFloat(this.t.version.match(/\d+(\.\d+)?/)[0],10):0}catch(h){this.t.Zd=0}try{this.La.Zd=
this.La.version?parseFloat(this.La.version.match(/\d+(\.\d+)?/)[0],10):0}catch(k){this.La.Zd=0}};function p(a,b){this.x=a;this.y=b}e=p.prototype;e.length=function(){return Math.sqrt(this.x*this.x+this.y*this.y)};e.M=function(){return new p(this.x,this.y)};e.add=function(a){return new p(this.x+a.x,this.y+a.y)};function da(a,b){return new p(a.x-b.x,a.y-b.y)}e.scale=function(a){return new p(a*this.x,a*this.y)};
e.rotate=function(a){var b=Math.sin(a*Math.PI/180);a=Math.cos(a*Math.PI/180);return new p(a*this.x+b*this.y,-b*this.x+a*this.y)};e.normalize=function(){var a=Math.sqrt(this.x*this.x+this.y*this.y);return 0===a?new p(0,0):new p(this.x/a,this.y/a)};function ea(a){return(new p(a.y,-a.x)).normalize()}
e.sb=function(a,b,c){var d=Math.min(8,this.length()/4),g=da(this,this.normalize().scale(2*d)),h=g.add(ea(this).scale(d)),d=g.add(ea(this).scale(-d)),k=w.context;k.strokeStyle=c;k.beginPath();k.moveTo(a,b);k.lineTo(a+g.x,b+g.y);k.lineTo(a+h.x,b+h.y);k.lineTo(a+this.x,b+this.y);k.lineTo(a+d.x,b+d.y);k.lineTo(a+g.x,b+g.y);k.stroke()};function fa(a){this.qi=4294967296;this.sh=1664525;this.Hh=1013904223;this.state=void 0===a?Math.floor(Math.random()*(this.qi-1)):a}
fa.prototype.M=function(){var a=new fa;a.qi=this.qi;a.sh=this.sh;a.Hh=this.Hh;a.state=this.state;return a};fa.prototype.random=function(a){var b=1;void 0!==a&&(b=a);this.state=(this.sh*this.state+this.Hh)%this.qi;return this.state/this.qi*b};new fa;function ga(){this.be="";this.Nl=[];this.rh=[];this.Oe=[];this.$f=[];this.nc=[];this.ua("start");this.ua("load");this.ua("game")}function ha(a){var b=ia;b.be=a;""!==b.be&&"/"!==b.be[b.be.length-1]&&(b.be+="/")}e=ga.prototype;
e.ua=function(a){this.nc[a]||(this.rh[a]=0,this.Oe[a]=0,this.$f[a]=0,this.nc[a]=[],this.Nl[a]=!1)};e.loaded=function(a){return this.nc[a]?this.Oe[a]:0};e.wc=function(a){return this.nc[a]?this.$f[a]:0};e.complete=function(a){return this.nc[a]?this.Oe[a]+this.$f[a]===this.rh[a]:!0};function ja(a){var b=ia;return b.nc[a]?100*(b.Oe[a]+b.$f[a])/b.rh[a]:100}function ka(a){var b=ia;b.Oe[a]+=1;b.complete(a)&&la("Load Complete",{Va:a})}function ma(a){var b=ia;b.$f[a]+=1;la("Load Failed",{Va:a})}
function na(a,b,c){var d=ia;d.nc[b]||d.ua(b);d.nc[b].push(a);d.rh[b]+=c}e.td=function(a){var b;if(!this.Nl[a])if(this.Nl[a]=!0,this.nc[a]&&0!==this.nc[a].length)for(b=0;b<this.nc[a].length;b+=1)this.nc[a][b].td(a,this.be);else la("Load Complete",{Va:a})};var ia=new ga;function oa(a){this.context=this.canvas=void 0;this.height=this.width=0;a&&this.mb(a)}oa.prototype.mb=function(a){this.canvas=a;this.context=a.getContext("2d");this.width=a.width;this.height=a.height};
oa.prototype.clear=function(){this.context.clearRect(0,0,this.width,this.height);this.context.beginPath();this.context.moveTo(0,0);this.context.lineTo(-1,-1);this.context.closePath();this.context.stroke()};
function pa(a,b,c,d,g,h){var k=w;k.context.save();!1===h?(k.context.fillStyle=g,k.context.fillRect(a,b,c,d)):!0===h?(k.context.strokeStyle=g,k.context.strokeRect(a,b,c,d)):(void 0!==g&&(k.context.fillStyle=g,k.context.fillRect(a,b,c,d)),void 0!==h&&(k.context.strokeStyle=h,k.context.strokeRect(a,b,c,d)));k.context.restore()}
function qa(a,b,c,d){var g=w;g.context.save();g.context.beginPath();g.context.moveTo(a,b);g.context.lineTo(c,d);g.context.lineWidth=1;g.context.strokeStyle="green";g.context.stroke();g.context.restore()}
oa.prototype.cc=function(a,b,c,d,g,h,k){this.context.save();this.context.font=g;!1===h?(this.context.fillStyle=d,this.context.fillText(a,b,c)):!0===h?(this.context.strokeStyle=d,this.context.strokeText(a,b,c)):(void 0!==d&&(this.context.fillStyle=d,this.context.fillText(a,b,c)),void 0!==h&&(k&&(this.context.lineWidth=k),this.context.strokeStyle=h,this.context.strokeText(a,b,c)));this.context.restore()};oa.prototype.da=function(a,b){this.context.font=b;return this.context.measureText(a).width};
var w=new oa(aa);function ra(a,b,c){this.name=a;this.L=b;this.pv=c;this.pc=[];this.Hm=[];na(this,this.pv,this.L)}ra.prototype.td=function(a,b){function c(){ma(a)}function d(){ka(a)}var g,h;for(g=0;g<this.pc.length;g+=1)h=this.Hm[g],0!==h.toLowerCase().indexOf("http:")&&0!==h.toLowerCase().indexOf("https:")&&(h=b+h),this.pc[g].src=h,this.pc[g].addEventListener("load",d,!1),this.pc[g].addEventListener("error",c,!1)};
ra.prototype.complete=function(){var a;for(a=0;a<this.pc.length;a+=1)if(!this.pc[a].complete||0===this.pc[a].width)return!1;return!0};function sa(a,b,c){0<=b&&b<a.L&&(a.pc[b]=new Image,a.Hm[b]=c)}ra.prototype.e=function(a,b){0<=a&&a<this.L&&(this.pc[a]=b,this.Hm[a]="")};ra.prototype.ra=function(a,b,c,d,g,h,k,l,n){this.pc[a]&&this.pc[a].complete&&(void 0===l&&(l=d),void 0===n&&(n=g),0>=d||0>=g||0!==Math.round(l)&&0!==Math.round(n)&&w.context.drawImage(this.pc[a],b,c,d,g,h,k,l,n))};
function x(a,b,c,d,g,h,k,l,n,q){this.name=a;this.He=b;this.L=c;this.width=d;this.height=g;this.zb=h;this.Ab=k;this.Lh=l;this.lg=n;this.Bg=q;this.Ce=[];this.De=[];this.Ee=[];this.Vd=[];this.Ud=[];this.Wd=[];this.Xd=[]}e=x.prototype;e.e=function(a,b,c,d,g,h,k,l){0<=a&&a<this.L&&(this.Ce[a]=b,this.De[a]=c,this.Ee[a]=d,this.Vd[a]=g,this.Ud[a]=h,this.Wd[a]=k,this.Xd[a]=l)};e.complete=function(){return this.He.complete()};
e.u=function(a,b,c){a=(Math.round(a)%this.L+this.L)%this.L;this.He.ra(this.Ce[a],this.De[a],this.Ee[a],this.Vd[a],this.Ud[a],b-this.zb+this.Wd[a],c-this.Ab+this.Xd[a])};e.ed=function(a,b,c,d){var g=w.context,h=g.globalAlpha;g.globalAlpha=d;a=(Math.round(a)%this.L+this.L)%this.L;this.He.ra(this.Ce[a],this.De[a],this.Ee[a],this.Vd[a],this.Ud[a],b-this.zb+this.Wd[a],c-this.Ab+this.Xd[a]);g.globalAlpha=h};
e.oa=function(a,b,c,d,g,h,k){var l=w.context;1E-4>Math.abs(d)||1E-4>Math.abs(g)||(a=(Math.round(a)%this.L+this.L)%this.L,l.save(),l.translate(b,c),l.rotate(-h*Math.PI/180),l.scale(d,g),l.globalAlpha=k,this.He.ra(this.Ce[a],this.De[a],this.Ee[a],this.Vd[a],this.Ud[a],this.Wd[a]-this.zb,this.Xd[a]-this.Ab),l.restore())};
e.ra=function(a,b,c,d,g,h,k,l){var n=w.context,q=n.globalAlpha,v,D,A,r;a=(Math.round(a)%this.L+this.L)%this.L;v=this.Wd[a];D=this.Xd[a];A=this.Vd[a];r=this.Ud[a];b-=v;c-=D;0>=b+d||0>=c+g||b>=A||c>=r||(0>b&&(d+=b,h-=b,b=0),0>c&&(g+=c,k-=c,c=0),b+d>A&&(d=A-b),c+g>r&&(g=r-c),n.globalAlpha=l,this.He.ra(this.Ce[a],this.De[a]+b,this.Ee[a]+c,d,g,h,k),n.globalAlpha=q)};
e.Am=function(a,b,c,d,g,h,k,l,n,q,v,D){var A,r,s,t,u,L,ca,R,W,xa;if(!(0>=h||0>=k))for(b=Math.round(b)%h,0<b&&(b-=h),c=Math.round(c)%k,0<c&&(c-=k),A=Math.ceil((q-b)/h),r=Math.ceil((v-c)/k),b+=l,c+=n,W=0;W<A;W+=1)for(xa=0;xa<r;xa+=1)u=d,L=g,ca=h,R=k,s=b+W*h,t=c+xa*k,s<l&&(u+=l-s,ca-=l-s,s=l),s+ca>=l+q&&(ca=l+q-s),t<n&&(L+=n-t,R-=n-t,t=n),t+R>=n+v&&(R=n+v-t),0<ca&&0<R&&this.ra(a,u,L,ca,R,s,t,D)};e.Ej=function(a,b,c,d,g,h,k,l,n,q){this.Am(a,0,0,b,c,d,g,h,k,l,n,q)};
e.Dj=function(a,b,c,d,g,h,k,l,n,q){var v=w.context,D=v.globalAlpha,A,r,s,t,u,L;a=(Math.round(a)%this.L+this.L)%this.L;A=l/d;r=n/g;s=this.Wd[a];t=this.Xd[a];u=this.Vd[a];L=this.Ud[a];b-=s;c-=t;0>=b+d||0>=c+g||b>=u||c>=L||(0>b&&(d+=b,l+=A*b,h-=A*b,b=0),0>c&&(g+=c,n+=r*c,k-=r*c,c=0),b+d>u&&(l-=A*(d-u+b),d=u-b),c+g>L&&(n-=r*(g-L+c),g=L-c),v.globalAlpha=q,this.He.ra(this.Ce[a],this.De[a]+b,this.Ee[a]+c,d,g,h,k,l,n),v.globalAlpha=D)};
function ta(a,b,c){var d,g,h;for(d=0;d<a.L;d+=1)g=b+d%a.Bg*a.width,h=c+a.height*Math.floor(d/a.Bg),a.He.ra(a.Ce[d],a.De[d],a.Ee[d],a.Vd[d],a.Ud[d],g-a.zb+a.Wd[d],h-a.Ab+a.Xd[d])}function y(a,b){this.canvas=document.createElement("canvas");this.context=this.canvas.getContext("2d");this.width=a;this.height=b;this.Ab=this.zb=0;this.canvas.width=a;this.canvas.height=b;this.clear();this.Ck=void 0}e=y.prototype;
e.M=function(){var a=new y(this.width,this.height);a.zb=this.zb;a.Ab=this.Ab;z(a);this.u(0,0);B(a);return a};function z(a){a.Ck=w.canvas;w.mb(a.canvas)}function B(a){w.canvas===a.canvas&&void 0!==a.Ck&&(w.mb(a.Ck),a.Ck=void 0)}e.clear=function(){this.context.clearRect(0,0,this.canvas.width,this.canvas.height)};e.u=function(a,b){w.context.drawImage(this.canvas,a-this.zb,b-this.Ab)};
e.ed=function(a,b,c){var d=w.context,g=d.globalAlpha;d.globalAlpha=c;w.context.drawImage(this.canvas,a-this.zb,b-this.Ab);d.globalAlpha=g};e.oa=function(a,b,c,d,g,h){var k=w.context;1E-4>Math.abs(c)||1E-4>Math.abs(d)||(k.save(),k.translate(a,b),k.rotate(-g*Math.PI/180),k.scale(c,d),k.globalAlpha=h,w.context.drawImage(this.canvas,-this.zb,-this.Ab),k.restore())};
e.ra=function(a,b,c,d,g,h,k){var l=w.context,n=l.globalAlpha;0>=c||0>=d||(a+c>this.width&&(c=this.width-a),b+d>this.height&&(d=this.height-b),l.globalAlpha=k,w.context.drawImage(this.canvas,a,b,c,d,g,h,c,d),l.globalAlpha=n)};
e.Am=function(a,b,c,d,g,h,k,l,n,q,v){var D,A,r,s,t,u,L,ca,R,W;if(!(0>=g||0>=h))for(c+g>this.width&&(g=this.width-c),d+h>this.height&&(h=this.height-d),a=Math.round(a)%g,0<a&&(a-=g),b=Math.round(b)%h,0<b&&(b-=h),D=Math.ceil((n-a)/g),A=Math.ceil((q-b)/h),a+=k,b+=l,R=0;R<D;R+=1)for(W=0;W<A;W+=1)t=c,u=d,L=g,ca=h,r=a+R*g,s=b+W*h,r<k&&(t+=k-r,L-=k-r,r=k),r+L>=k+n&&(L=k+n-r),s<l&&(u+=l-s,ca-=l-s,s=l),s+ca>=l+q&&(ca=l+q-s),0<L&&0<ca&&this.ra(t,u,L,ca,r,s,v)};
e.Ej=function(a,b,c,d,g,h,k,l,n){this.Am(0,0,a,b,c,d,g,h,k,l,n)};e.Dj=function(a,b,c,d,g,h,k,l,n){var q=w.context,v=q.globalAlpha;0>=c||0>=d||(a+c>this.width&&(c=this.width-a),b+d>this.height&&(d=this.height-b),0!==Math.round(k)&&0!==Math.round(l)&&(q.globalAlpha=n,w.context.drawImage(this.canvas,a,b,c,d,g,h,k,l),q.globalAlpha=v))};
function ua(a,b,c,d){this.O=a;this.Xx=b;this.Ox=c;this.Xi=[{text:"MiHhX!@v&Qq",width:-1,font:"sans-serif"},{text:"MiHhX!@v&Qq",width:-1,font:"serif"},{text:"AaMm#@!Xx67",width:-1,font:"sans-serif"},{text:"AaMm#@!Xx67",width:-1,font:"serif"}];this.Hs=!1;na(this,d,1)}function va(a,b,c){w.context.save();w.context.font="250pt "+a+", "+b;a=w.context.measureText(c).width;w.context.restore();return a}
function wa(a){var b,c,d;for(b=0;b<a.Xi.length;b+=1)if(c=a.Xi[b],d=va(a.O,c.font,c.text),c.width!==d){ka(a.ov);document.body.removeChild(a.$d);a.Hs=!0;return}window.setTimeout(function(){wa(a)},33)}
ua.prototype.td=function(a,b){var c="@font-face {font-family: "+this.O+";src: url('"+b+this.Xx+"') format('woff'), url('"+b+this.Ox+"') format('truetype');}",d=document.createElement("style");d.id=this.O+"_fontface";d.type="text/css";d.styleSheet?d.styleSheet.cssText=c:d.appendChild(document.createTextNode(c));document.getElementsByTagName("head")[0].appendChild(d);this.$d=document.createElement("span");this.$d.style.position="absolute";this.$d.style.left="-9999px";this.$d.style.top="-9999px";this.$d.style.visibility=
"hidden";this.$d.style.fontSize="250pt";this.$d.id=this.O+"_loader";document.body.appendChild(this.$d);for(c=0;c<this.Xi.length;c+=1)d=this.Xi[c],d.width=va(d.font,d.font,d.text);this.ov=a;wa(this)};ua.prototype.complete=function(){return this.Hs};
function ya(a,b){this.O=a;this.Vh=b;this.fontWeight=this.fontStyle="";this.Oc="normal";this.fontSize=12;this.fill=!0;this.gf=1;this.xc=0;this.fillColor="black";this.Nc={f:void 0,ob:0,fo:!0,ho:!0};this.Ua={Qi:!0,L:3,xj:["red","white","blue"],size:.6,offset:0};this.fillStyle=void 0;this.stroke=!1;this.Nf=1;this.Mg=0;this.strokeColor="black";this.strokeStyle=void 0;this.Ec=1;this.Td=!1;this.Of="miter";this.S={i:!1,color:"rgba(10, 10, 10, 0.3)",offsetX:3,offsetY:3,blur:1};this.align="left";this.h="top";
this.ta=this.Ka=0}e=ya.prototype;
e.M=function(){var a=new ya(this.O,this.Vh);a.fontStyle=this.fontStyle;a.fontWeight=this.fontWeight;a.Oc=this.Oc;a.fontSize=this.fontSize;a.fill=this.fill;a.gf=this.gf;a.xc=this.xc;a.fillColor=this.fillColor;a.Nc={f:this.Nc.f,fo:this.Nc.fo,ho:this.Nc.ho};a.Ua={Qi:this.Ua.Qi,L:this.Ua.L,xj:this.Ua.xj.slice(0),size:this.Ua.size,offset:this.Ua.offset};a.fillStyle=this.fillStyle;a.stroke=this.stroke;a.Nf=this.Nf;a.Mg=this.Mg;a.strokeColor=this.strokeColor;a.strokeStyle=this.strokeStyle;a.Ec=this.Ec;a.Td=
this.Td;a.Of=this.Of;a.S={i:this.S.i,color:this.S.color,offsetX:this.S.offsetX,offsetY:this.S.offsetY,blur:this.S.blur};a.align=this.align;a.h=this.h;a.Ka=this.Ka;a.ta=this.ta;return a};
function C(a,b){void 0!==b.O&&(a.O=b.O);void 0!==b.Vh&&(a.Vh=b.Vh);void 0!==b.fontStyle&&(a.fontStyle=b.fontStyle);void 0!==b.fontWeight&&(a.fontWeight=b.fontWeight);void 0!==b.Oc&&(a.Oc=b.Oc);void 0!==b.fontSize&&(a.fontSize=b.fontSize);void 0!==b.fill&&(a.fill=b.fill);void 0!==b.gf&&(a.gf=b.gf);void 0!==b.fillColor&&(a.xc=0,a.fillColor=b.fillColor);void 0!==b.Nc&&(a.xc=1,a.Nc=b.Nc);void 0!==b.Ua&&(a.xc=2,a.Ua=b.Ua);void 0!==b.fillStyle&&(a.xc=3,a.fillStyle=b.fillStyle);void 0!==b.stroke&&(a.stroke=
b.stroke);void 0!==b.Nf&&(a.Nf=b.Nf);void 0!==b.strokeColor&&(a.Mg=0,a.strokeColor=b.strokeColor);void 0!==b.strokeStyle&&(a.Mg=3,a.strokeStyle=b.strokeStyle);void 0!==b.Ec&&(a.Ec=b.Ec);void 0!==b.Td&&(a.Td=b.Td);void 0!==b.Of&&(a.Of=b.Of);void 0!==b.S&&(a.S=b.S);void 0!==b.align&&(a.align=b.align);void 0!==b.h&&(a.h=b.h);void 0!==b.Ka&&(a.Ka=b.Ka);void 0!==b.ta&&(a.ta=b.ta)}function za(a,b){a.fontWeight=void 0===b?"":b}function E(a,b){a.fontSize=void 0===b?12:b}
function Aa(a,b){a.gf=void 0===b?1:b}e.setFillColor=function(a){this.xc=0;this.fillColor=void 0===a?"black":a};function Ba(a,b,c,d,g){a.xc=2;a.Ua.Qi=!0;a.Ua.L=b;a.Ua.xj=c.slice(0);a.Ua.size=void 0===d?.6:d;a.Ua.offset=void 0===g?0:g}function Ca(a,b){a.stroke=void 0===b?!1:b}function Da(a,b){a.Nf=void 0===b?1:b}e.setStrokeColor=function(a){this.Mg=0;this.strokeColor=void 0===a?"black":a};function Ea(a,b){a.Ec=void 0===b?1:b}function Fa(a,b){a.Td=void 0===b?!1:b}
function Ga(a,b){a.Of=void 0===b?"miter":b}function Ha(a,b,c){void 0===b?a.S.i=!0:a.S={i:!0,color:b,offsetX:0,offsetY:c,blur:2}}function F(a,b){a.align=void 0===b?"left":b}function G(a,b){a.h=void 0===b?"top":b}function Ia(a){return a.fontStyle+" "+a.fontWeight+" "+a.fontSize+"px "+a.O+", "+a.Vh}function Ja(a){var b=0,c;for(c=0;c<a.length;c+=1)b=Math.max(b,a[c].width);return b}function La(a,b){return a.fontSize*b.length+a.ta*(b.length-1)}
function Ma(a,b,c){var d,g,h,k,l,n,q=[],v=w.context;v.font=Ia(a);switch(a.Oc){case "upper":b=b.toUpperCase();break;case "lower":b=b.toLowerCase()}if(void 0===c){n=b.split("\n");for(a=0;a<n.length;a+=1)q.push({text:n[a],width:v.measureText(n[a]).width});return q}n=b.split("\n");h=v.measureText(" ").width;for(a=0;a<n.length;a+=1){g=n[a].split(" ");d=g[0];l=v.measureText(g[0]).width;for(b=1;b<g.length;b+=1)k=v.measureText(g[b]).width,l+h+k<c?(d+=" "+g[b],l+=h+k):(q.push({text:d,width:l}),d=g[b],l=k);
q.push({text:d,width:l})}return q}e.da=function(a,b){var c;w.context.save();c=Ja(Ma(this,a,b));w.context.restore();return c};e.V=function(a,b){var c;w.context.save();c=La(this,Ma(this,a,b));w.context.restore();return c};function Na(a,b,c,d,g,h){var k=a.fontSize;a.fontSize=b;b=h?Ma(a,c,d):Ma(a,c);d=Ja(b)<=d&&La(a,b)<=g;a.fontSize=k;return d}
function Oa(a,b,c,d,g){var h=0,k=32;void 0===g&&(g=!1);for(w.context.save();Na(a,h+k,b,c,d,g);)h+=k;for(;2<=k;)k/=2,Na(a,h+k,b,c,d,g)&&(h+=k);w.context.restore();return Math.max(4,h)}function Pa(a,b,c,d,g){var h=Math.max(.01,a.Ua.size),k=a.Ua.offset;a.Ua.Qi?(k=g/2+k*g,h=.5*h*g,b=w.context.createLinearGradient(b,c+k-h,b,c+k+h)):(k=d/2+k*d,h=.5*h*d,b=w.context.createLinearGradient(b+k-h,c,b+k+h,c));c=1/(a.Ua.L-1);for(d=0;d<a.Ua.L;d+=1)b.addColorStop(d*c,a.Ua.xj[d]);return b}
function Qa(a,b,c,d,g,h,k){var l,n;!a.fill&&a.S.i?(b.shadowColor=a.S.color,b.shadowOffsetX=a.S.offsetX,b.shadowOffsetY=a.S.offsetY,b.shadowBlur=a.S.blur):(b.shadowColor=void 0,b.shadowOffsetX=0,b.shadowOffsetY=0,b.shadowBlur=0);b.globalAlpha=k*a.Nf;switch(a.Mg){case 0:b.strokeStyle=a.strokeColor;break;case 3:b.strokeStyle=a.strokeStyle}b.lineWidth=a.Ec;b.lineJoin=a.Of;for(k=0;k<c.length;k+=1){l=0;switch(a.align){case "right":l=h-c[k].width;break;case "center":l=(h-c[k].width)/2}n=a.fontSize*(k+1)+
a.ta*k;b.strokeText(c[k].text,d+l,g+n)}}
function Ra(a,b,c,d,g,h,k){c=Ma(a,c,k);k=Ja(c);var l=La(a,c);b.textAlign="left";b.textBaseline="bottom";switch(a.align){case "right":d+=-k;break;case "center":d+=-k/2}switch(a.h){case "base":case "bottom":g+=-l+Math.round(a.Ka*a.fontSize);break;case "middle":g+=-l/2+Math.round(a.Ka*a.fontSize/2)}b.font=Ia(a);a.stroke&&a.Td&&Qa(a,b,c,d,g,k,h);if(a.fill){var n=d,q=g,v,D;a.S.i?(b.shadowColor=a.S.color,b.shadowOffsetX=a.S.offsetX,b.shadowOffsetY=a.S.offsetY,b.shadowBlur=a.S.blur):(b.shadowColor=void 0,
b.shadowOffsetX=0,b.shadowOffsetY=0,b.shadowBlur=0);b.globalAlpha=h*a.gf;switch(a.xc){case 0:b.fillStyle=a.fillColor;break;case 1:l=a.Nc.f;D=new y(l.width,l.height);var A=a.Nc.fo,r=a.Nc.ho;A&&r?v="repeat":A&&!r?v="repeat-x":!A&&r?v="repeat-y":A||r||(v="no-repeat");z(D);l.u(a.Nc.ob,0,0);B(D);v=w.context.createPattern(D.canvas,v);b.fillStyle=v;break;case 2:b.fillStyle=Pa(a,n,q,k,l);break;case 3:b.fillStyle=a.fillStyle;break;default:b.fillStyle=a.fillColor}for(v=0;v<c.length;v+=1){l=0;switch(a.align){case "right":l=
k-c[v].width;break;case "center":l=(k-c[v].width)/2}D=a.fontSize*(v+1)+a.ta*v;2===a.xc&&a.Ua.Qi&&(b.fillStyle=Pa(a,n,q+D-a.fontSize,k,a.fontSize));b.fillText(c[v].text,n+l,q+D)}}a.stroke&&!a.Td&&Qa(a,b,c,d,g,k,h)}e.u=function(a,b,c,d){var g=w.context;this.fill&&1===this.xc?this.oa(a,b,c,1,1,0,1,d):(g.save(),Ra(this,g,a,b,c,1,d),g.restore())};e.ed=function(a,b,c,d,g){var h=w.context;this.fill&&1===this.xc?this.oa(a,b,c,1,1,0,d,g):(h.save(),Ra(this,h,a,b,c,d,g),h.restore())};
e.oa=function(a,b,c,d,g,h,k,l){var n=w.context;n.save();n.translate(b,c);n.rotate(-h*Math.PI/180);n.scale(d,g);try{Ra(this,n,a,0,0,k,l)}catch(q){}n.restore()};
function Sa(){this.Ev=10;this.aj=-1;this.Jt="stop_lowest_prio";this.Ap=this.Oa=this.Wa=!1;var a,b=this,c="undefined"!==typeof AudioContext?AudioContext:"undefined"!==typeof webkitAudioContext?webkitAudioContext:void 0;if(c)this.Wa=!0;else if("undefined"!==typeof Audio)try{"undefined"!==typeof(new Audio).canPlayType&&(this.Oa=!0)}catch(d){}this.Ap=this.Wa||this.Oa;this.Oa&&m.t.Lg&&(this.aj=1);if(this.Ap)try{a=new Audio,this.ip={ogg:!!a.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/,""),mp3:!!a.canPlayType("audio/mpeg;").replace(/^no$/,
""),opus:!!a.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/,""),wav:!!a.canPlayType('audio/wav; codecs="1"').replace(/^no$/,""),m4a:!!(a.canPlayType("audio/x-m4a;")||a.canPlayType("audio/aac;")).replace(/^no$/,""),mp4:!!(a.canPlayType("audio/x-mp4;")||a.canPlayType("audio/aac;")).replace(/^no$/,""),weba:!!a.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/,"")}}catch(g){this.ip={ogg:!1,mp3:!0,opus:!1,wav:!1,m4a:!1,mp4:!1,weba:!1}}this.Tb=[];this.Ne={};this.Pa={};this.bc={};this.xd=
[];this.ac=0;this.Wa?(this.wd=new c,this.jp="function"===typeof this.wd.createGain?function(){return b.wd.createGain()}:"function"===typeof this.wd.createGainNode?function(){return b.wd.createGainNode()}:function(){},this.yd={},this.$i=this.jp(),void 0===this.$i?(this.Oa=!0,this.dh=Sa.prototype.Ml):(this.$i.connect(this.wd.destination),this.yd.master=this.$i,this.dh=Sa.prototype.It)):this.dh=this.Oa?Sa.prototype.Ml:function(){}}
function Ta(a){var b=H,c,d,g,h,k;for(c=0;c<b.Tb.length;c+=1)if((d=b.Tb[c])&&0===d.Gm)if(d.paused)d.np&&(d.Ol+=a,d.Ol>=d.np&&b.Ai(d.id));else if(d.Pl+=a,d.Zf&&d.Pl>=d.vs)d.Zf=!1,Ua(b,d,d.Ad);else if(d.qd&&b.Oa&&b.md(d.id)>=d.duration)if(d.En)try{d.F.pause(),d.F.currentTime=d.Ad/1E3,4===d.F.readyState?d.F.play():(g=function(){var a=d;return{ready:function(){a.F.play();a.F.removeEventListener("canplaythrough",g.ready,!1)}}}(),d.F.addEventListener("canplaythrough",g.ready,!1))}catch(l){}else d.F.pause(),
Va(d);for(c=b.xd.length-1;0<=c;c-=1)h=b.xd[c],b.br(h.id)||0!==h.Gm||(h.r+=a,h.r>=h.duration?(H.sd(h.id,h.Hi),void 0!==b.bc[h.id]&&(b.bc[h.id]=h.Hi),h.Lb&&h.Lb(),b.xd.splice(c,1)):(k=h.Ma(h.r,h.start,h.Hi-h.start,h.duration),H.sd(h.id,k),void 0!==b.bc[h.id]&&(b.bc[h.id]=k)))}function Wa(a,b){a.Ne[b.Rb.s.name]?a.Ne[b.Rb.s.name].length<a.Ev&&a.Ne[b.Rb.s.name].push(b.F):a.Ne[b.Rb.s.name]=[b.F]}
function Xa(a,b){var c,d,g;g=[];for(c=0;c<a.Tb.length;c+=1)(d=a.Tb[c])&&0<=d.ka.indexOf(b)&&g.push(d);return g}function Ya(a,b){if(0<a.aj&&a.ac>=a.aj)switch(a.Jt){case "cancel_new":return!1;case "stop_lowest_prio":var c,d,g;for(c=0;c<a.Tb.length;c+=1)(d=a.Tb[c])&&d.qd&&!d.paused&&(void 0===g||g.Xk<d.Xk)&&(g=d);if(g.Xk>b.nh){a.stop(g.id);break}return!1}return!0}
function Za(a,b){var c,d=1;for(c=0;c<b.ka.length;c+=1)void 0!==H.Pa[b.ka[c]]&&(d*=H.Pa[b.ka[c]]);c=a.jp();c.gain.value=d;c.connect(a.$i);a.yd[b.id]=c;b.F.connect(c)}function $a(a,b){b.F.disconnect(0);a.yd[b.id]&&(a.yd[b.id].disconnect(0),delete a.yd[b.id])}function ab(a,b){var c;if(b.s&&b.s.Jb){if(a.Wa)return c=a.wd.createBufferSource(),c.buffer=b.s.Jb,c.loopStart=b.startOffset/1E3,c.loopEnd=(b.startOffset+b.duration)/1E3,c;if(a.Oa)return c=b.s.Jb.cloneNode(!0),c.volume=0,c}}
function bb(a,b){var c,d;if(a.Wa)(c=ab(a,b))&&(d=new cb(b,c));else if(a.Oa){c=a.Ne[b.s.name];if(!c)return;0<c.length?d=new cb(b,c.pop()):(c=ab(a,b))&&(d=new cb(b,c))}if(d){a.Wa&&Za(a,d);for(c=0;c<a.Tb.length;c+=1)if(void 0===a.Tb[c])return a.Tb[c]=d;a.Tb.push(d)}return d}function db(a){var b=H,c,d;for(c=0;c<a.length;c+=1)if(d=a[c].split(".").pop(),b.ip[d])return a[c];return!1}e=Sa.prototype;
e.Ml=function(a,b,c){function d(){var b;a.loaded=!0;ka(c);a.duration=Math.ceil(1E3*a.Jb.duration);a.Jb.removeEventListener("canplaythrough",d,!1);a.Jb.removeEventListener("error",g,!1);b=a.Jb.cloneNode(!0);H.Ne[a.name].push(b)}function g(){ma(c)}(b=db(b))?(a.Jb=new Audio,a.Jb.src=b,a.Jb.autoplay=!1,a.Jb.aA="auto",a.Jb.addEventListener("canplaythrough",d,!1),a.Jb.addEventListener("error",g,!1),a.Jb.load()):g()};
e.It=function(a,b,c){var d=db(b),g=new XMLHttpRequest;g.open("GET",d,!0);g.responseType="arraybuffer";g.onload=function(){H.wd.decodeAudioData(g.response,function(b){b&&(a.Jb=b,a.duration=1E3*b.duration,a.loaded=!0,ka(c))},function(){ma(c)})};g.onerror=function(){"undefined"!==typeof Audio&&(H.Wa=!1,H.Oa=!0,H.dh=Sa.prototype.Ml,H.dh(a,b,c))};try{g.send()}catch(h){}};
e.play=function(a,b,c,d){if(a instanceof eb){if(Ya(this,a)){a=bb(this,a);if(!a)return-1;a.vs=b||0;a.Zf=0<b;a.Wb=c||0;a.Hd=d||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b};a.Zf||Ua(this,a,a.Ad);return a.id}return-1}};
function Ua(a,b,c){var d;"number"!==typeof c&&(c=0);fb(a,b.id);0<b.Wb&&(d=gb(a,b.id),a.sd(b.id,0),hb(a,b.id,d,b.Wb,b.Hd),b.Wb=0,b.Hd=void 0);if(a.Wa){d=c-b.Ad;b.Lt=1E3*a.wd.currentTime-d;b.F.onended=function(){Va(b)};try{b.F.start?b.F.start(0,c/1E3,(b.duration-d)/1E3):b.F.noteGrainOn&&b.F.noteGrainOn(0,c/1E3,(b.duration-d)/1E3),b.ad=!0,b.qd=!0,a.ac+=1,b.F.loop=b.En}catch(g){}}else if(a.Oa){if(4!==b.F.readyState){var h=function(){return{ready:function(){b.F.currentTime=c/1E3;b.F.play();b.ad=!0;b.F.removeEventListener("canplaythrough",
h.ready,!1)}}}();b.F.addEventListener("canplaythrough",h.ready,!1)}else b.F.currentTime=c/1E3,b.F.play(),b.ad=!0;b.qd=!0;a.ac+=1}}
e.Ai=function(a,b,c,d){var g,h,k,l,n=Xa(this,a);for(g=0;g<n.length;g+=1)if(h=n[g],(h.paused||!h.qd)&&!d||!h.paused&&d){if(!d){for(g=this.xd.length-1;0<=g;g-=1)if(a=this.xd[g],a.id===h.id){l=a;b=0;c=void 0;break}h.paused=!1;h.Wb=b||0;h.Hd=c||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b};h.ah&&(void 0===b&&(h.Wb=h.ah.duration),void 0===c&&(h.Hd=h.ah.Ma),k=h.ah.gain,h.ah=void 0)}this.Wa&&(a=ab(this,h.Rb))&&(h.F=a,Za(this,h));void 0!==k&&H.sd(h.id,k);Ua(this,h,h.Ad+(h.bj||0));void 0!==l&&
(H.sd(h.id,l.Ma(l.r,l.start,l.Hi-l.start,l.duration)),hb(H,h.id,l.Hi,l.duration-l.r,l.Ma,l.Lb))}};
e.pause=function(a,b,c,d,g){var h,k,l=Xa(this,a);for(a=0;a<l.length;a+=1)if(h=l[a],!h.paused)if(h.Wb=c||0,0<h.Wb)h.Hd=d||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b},h.ah={gain:ib(h.id),duration:h.Wb,Ma:h.Hd},hb(H,h.id,0,h.Wb,h.Hd,function(){H.pause(h.id,b)});else if(k=this.md(h.id),h.bj=k,g||(h.paused=!0,h.Ol=0,h.np=b,this.ac-=1),this.Wa){h.F.onended=function(){};if(h.qd&&h.ad){try{h.F.stop?h.F.stop(0):h.F.noteOff&&h.F.noteOff(0)}catch(n){}h.ad=!1}$a(this,h)}else this.Oa&&h.F.pause()};
function Va(a){var b=H;b.Pa[a.id]&&delete b.Pa[a.id];a.paused||(b.ac-=1);b.Wa?(a.ad=!1,a.qd=!1,$a(b,a)):b.Oa&&Wa(b,a);b.Tb[b.Tb.indexOf(a)]=void 0}
e.stop=function(a,b,c){var d,g=Xa(this,a);for(a=0;a<g.length;a+=1)if(d=g[a],d.Wb=b||0,0<d.Wb)d.Hd=c||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b},hb(H,d.id,0,d.Wb,d.Hd,function(){H.stop(d.id)});else{this.Pa[d.id]&&delete this.Pa[d.id];d.qd&&!d.paused&&(this.ac-=1);if(this.Wa){if(d.qd&&!d.paused&&!d.Zf){if(d.ad){try{d.F.stop?d.F.stop(0):d.F.noteOff&&d.F.noteOff(0)}catch(h){}d.ad=!1}$a(this,d)}}else this.Oa&&(d.Zf||d.F.pause(),Wa(this,d));this.Tb[this.Tb.indexOf(d)]=void 0;d.qd=!1}};
function hb(a,b,c,d,g,h){var k;for(k=0;k<a.xd.length;k+=1)if(a.xd[k].id===b){a.xd.splice(k,1);break}a.xd.push({id:b,Hi:c,Ma:g||function(a,b,c,d){return a==d?b+c:c*(-Math.pow(2,-10*a/d)+1)+b},duration:d,r:0,start:gb(a,b),Lb:h,Gm:0})}function jb(a){var b=H,c;void 0===b.bc[a]&&(c=void 0!==b.Pa[a]?b.Pa[a]:1,b.sd(a,0),b.bc[a]=c)}function kb(a){var b=H;void 0!==b.bc[a]&&(b.sd(a,b.bc[a]),delete b.bc[a])}
e.position=function(a,b){var c,d,g,h,k=Xa(this,a);if(!isNaN(b)&&0<=b)for(c=0;c<k.length;c++)if(d=k[c],b%=d.duration,this.Wa)if(d.paused)d.bj=b;else{d.F.onended=function(){};if(d.ad){try{d.F.stop?d.F.stop(0):d.F.noteOff&&d.F.noteOff(0)}catch(l){}d.ad=!1}$a(this,d);this.ac-=1;if(g=ab(this,d.Rb))d.F=g,Za(this,d),Ua(this,d,d.Ad+b)}else this.Oa&&(4===d.F.readyState?d.F.currentTime=(d.Ad+b)/1E3:(h=function(){var a=d,c=b;return{Jq:function(){a.F.currentTime=(a.Ad+c)/1E3;a.F.removeEventListener("canplaythrough",
h.Jq,!1)}}}(),d.F.addEventListener("canplaythrough",h.Jq,!1)))};e.jo=function(a){H.position(a,0)};e.fl=function(a,b){var c,d=Xa(this,a);for(c=0;c<d.length;c+=1)d[c].En=b,this.Wa&&(d[c].F.loop=b)};function gb(a,b){return void 0!==a.Pa[b]?a.Pa[b]:1}function ib(a){var b=H,c=1,d=Xa(b,a)[0];if(d)for(a=0;a<d.ka.length;a+=1)void 0!==b.Pa[d.ka[a]]&&(c*=b.Pa[d.ka[a]]);return Math.round(100*c)/100}
e.sd=function(a,b){var c,d,g,h=1,k=Xa(this,a);this.Pa[a]=b;this.bc[a]&&delete this.bc[a];for(c=0;c<k.length;c+=1)if(d=k[c],0<=d.ka.indexOf(a)){for(g=0;g<d.ka.length;g+=1)void 0!==this.Pa[d.ka[g]]&&(h*=this.Pa[d.ka[g]]);h=Math.round(100*h)/100;this.Wa?this.yd[d.id].gain.value=h:this.Oa&&(d.F.volume=h)}};
function fb(a,b){var c,d,g,h=1,k=Xa(a,b);for(c=0;c<k.length;c+=1){d=k[c];for(g=0;g<d.ka.length;g+=1)void 0!==a.Pa[d.ka[g]]&&(h*=a.Pa[d.ka[g]]);h=Math.round(100*h)/100;a.Wa?a.yd[d.id].gain.value=h:a.Oa&&(d.F.volume=h)}}e.tp=function(a,b){var c,d,g,h=Xa(this,a);for(c=0;c<h.length;c+=1)for(d=h[c],b=[].concat(b),g=0;g<b.length;g+=1)0>d.ka.indexOf(b[g])&&d.ka.push(b[g]);fb(this,a)};e.br=function(a){if(a=Xa(this,a)[0])return a.paused};
e.md=function(a){if(a=Xa(this,a)[0]){if(this.Wa)return a.paused?a.bj:(1E3*H.wd.currentTime-a.Lt)%a.duration;if(H.Oa)return Math.ceil(1E3*a.F.currentTime-a.Ad)}};var H=new Sa;function lb(a,b,c,d){this.name=a;this.dw=b;this.hw=c;this.hc=d;this.loaded=!1;this.Jb=null;na(this,this.hc,1)}
lb.prototype.td=function(a,b){var c,d;c=this.dw;0!==c.toLowerCase().indexOf("http:")&&0!==c.toLowerCase().indexOf("https:")&&(c=b+c);d=this.hw;0!==d.toLowerCase().indexOf("http:")&&0!==d.toLowerCase().indexOf("https:")&&(d=b+d);H.Ne[this.name]=[];H.dh(this,[d,c],a)};lb.prototype.complete=function(){return this.loaded};
function eb(a,b,c,d,g,h,k){this.name=a;this.s=b;this.startOffset=c;this.duration=d;H.sd(this.name,void 0!==g?g:1);this.nh=void 0!==h?h:10;this.ka=[];k&&(this.ka=this.ka.concat(k));0>this.ka.indexOf(this.name)&&this.ka.push(this.name)}eb.prototype.complete=function(){return this.s.complete()};eb.prototype.Xk=function(a){void 0!==a&&(this.nh=a);return this.nh};eb.prototype.tp=function(a){var b;a=[].concat(a);for(b=0;b<a.length;b+=1)0>this.ka.indexOf(a[b])&&this.ka.push(a[b])};
function cb(a,b){this.Rb=a;this.Ad=this.Rb.startOffset;this.F=b;this.duration=this.Rb.duration;this.Kl()}cb.prototype.Kl=function(){this.id=Math.round(Date.now()*Math.random())+"";this.ka=["master",this.id].concat(this.Rb.ka);this.Xk=void 0!==this.Rb.nh?this.Rb.nh:10;this.paused=this.qd=this.En=!1;this.Pl=this.Gm=0;this.ad=this.Zf=!1;this.vs=this.bj=0;var a,b=1;for(a=0;a<this.ka.length;a+=1)void 0!==H.Pa[this.ka[a]]&&(b*=H.Pa[this.ka[a]]);!H.Wa&&H.Oa&&(this.F.volume=b)};
function mb(a,b){this.name=a;this.fileName=b;this.info=void 0}function nb(a){this.name=a;this.text="";this.wc=this.complete=!1}nb.prototype.Oe=function(a){4===a.readyState&&(this.complete=!0,(this.wc=200!==a.status)?la("Get Failed",{name:this.name}):(this.text=a.responseText,la("Get Complete",{name:this.name})))};
function ob(a,b){var c=new XMLHttpRequest;a.complete=!1;c.open("POST",b);c.setRequestHeader("Content-Type","text/plain;charset=UTF-8");c.onreadystatechange=function(){4===c.readyState&&(a.complete=!0,a.wc=200!==c.status,a.wc?la("Post Failed",{name:a.name}):la("Post Complete",{name:a.name}))};c.send(a.text)}function pb(a,b){var c=new XMLHttpRequest;c.open("GET",b,!1);try{c.send()}catch(d){return!1}a.complete=!0;a.wc=200!==c.status;if(a.wc)return!1;a.text=c.responseText;return!0}
function qb(a){a&&(this.Nd=a);this.clear();this.kh=this.bg=this.Kc=this.jh=this.ih=this.mh=this.fh=this.lh=this.zd=this.hh=this.gh=0;rb(this,this);sb(this,this);tb(this,this);this.ae=[];this.Xg=[];this.ph=[];this.I=0;this.op=!1;this.kk=this.startTime=Date.now();this.Mf=this.le=0;this.Fv=200;this.hc="";window.Ui(window.fp)}qb.prototype.clear=function(){this.D=[];this.qh=!1;this.Ib=[];this.Jl=!1};
function rb(a,b){window.addEventListener("click",function(a){var d,g,h;if(void 0!==b.Nd&&!(0<b.I)&&(d=b.Nd,g=d.getBoundingClientRect(),h=d.width/g.width*(a.clientX-g.left),d=d.height/g.height*(a.clientY-g.top),a.preventDefault(),b.Yf.x=h,b.Yf.y=d,b.Zg.push({x:b.Yf.x,y:b.Yf.y}),0<b.jh))for(a=b.D.length-1;0<=a&&!((h=b.D[a])&&h.i&&0>=h.I&&h.jn&&(h=h.jn(b.Yf.x,b.Yf.y),!0===h));a-=1);},!1);ub(a)}function ub(a){a.Yf={x:0,y:0};a.Zg=[]}
function sb(a,b){window.addEventListener("mousedown",function(a){0<b.I||(a.preventDefault(),window.focus(),b.mp>=Date.now()-1E3||(vb(b,0,a.clientX,a.clientY),wb(b,0)))},!1);window.addEventListener("mouseup",function(a){0<b.I||(a.preventDefault(),b.Zi>=Date.now()-1E3||(vb(b,0,a.clientX,a.clientY),xb(b,0)))},!1);window.addEventListener("mousemove",function(a){0<b.I||(a.preventDefault(),vb(b,0,a.clientX,a.clientY))},!1);window.addEventListener("touchstart",function(a){var d=a.changedTouches;b.mp=Date.now();
if(!(0<b.I))for(a.preventDefault(),window.focus(),a=0;a<d.length;a+=1)vb(b,d[a].identifier,d[a].clientX,d[a].clientY),wb(b,d[a].identifier)},!1);window.addEventListener("touchend",function(a){var d=a.changedTouches;b.Zi=Date.now();if(!(0<b.I))for(a.preventDefault(),a=0;a<d.length;a+=1)vb(b,d[a].identifier,d[a].clientX,d[a].clientY),xb(b,d[a].identifier)},!1);window.addEventListener("touchmove",function(a){var d=a.changedTouches;if(!(0<b.I))for(a.preventDefault(),a=0;a<d.length;a+=1)vb(b,d[a].identifier,
d[a].clientX,d[a].clientY)},!1);window.addEventListener("touchleave",function(a){var d=a.changedTouches;b.Zi=Date.now();if(!(0<b.I))for(a.preventDefault(),a=0;a<d.length;a+=1)vb(b,d[a].identifier,d[a].clientX,d[a].clientY),xb(b,d[a].identifier)},!1);window.addEventListener("touchcancel",function(a){var d=a.changedTouches;b.Zi=Date.now();if(!(0<b.I))for(a.preventDefault(),a=0;a<d.length;a+=1)vb(b,d[a].identifier,d[a].clientX,d[a].clientY),xb(b,d[a].identifier)},!1);window.addEventListener("mousewheel",
function(a){yb(b,a)},!1);window.addEventListener("DOMMouseScroll",function(a){yb(b,a)},!1);zb(a);a.mp=0;a.Zi=0}function zb(a){var b;a.na=[];for(b=0;16>b;b+=1)a.na[b]={id:-1,jb:!1,x:0,y:0};a.Re=[]}function Ab(a,b){var c=-1,d;for(d=0;16>d;d+=1)if(a.na[d].id===b){c=d;break}if(-1===c)for(d=0;16>d;d+=1)if(!a.na[d].jb){c=d;a.na[d].id=b;break}return c}
function vb(a,b,c,d){var g,h;void 0!==a.Nd&&(b=Ab(a,b),-1!==b&&(g=a.Nd,h=g.getBoundingClientRect(),a.na[b].x=g.width/h.width*(c-h.left),a.na[b].y=g.height/h.height*(d-h.top)))}function wb(a,b){var c=Ab(a,b),d,g;if(-1!==c&&!a.na[c].jb&&(a.Re.push({hf:c,x:a.na[c].x,y:a.na[c].y,jb:!0}),a.na[c].jb=!0,0<a.Kc))for(d=a.D.length-1;0<=d&&!((g=a.D[d])&&g.i&&0>=g.I&&g.sg&&(g=g.sg(c,a.na[c].x,a.na[c].y),!0===g));d-=1);}
function xb(a,b){var c=Ab(a,b),d,g;if(-1!==c&&a.na[c].jb&&(a.Re.push({hf:c,x:a.na[c].x,y:a.na[c].y,jb:!1}),a.na[c].jb=!1,0<a.Kc))for(d=a.D.length-1;0<=d&&!((g=a.D[d])&&g.i&&0>=g.I&&g.ug&&(g=g.ug(c,a.na[c].x,a.na[c].y),!0===g));d-=1);}
function yb(a,b){var c;if(!(0<a.I)){b.preventDefault();window.focus();c=Math.max(-1,Math.min(1,b.wheelDelta||-b.detail));var d,g;a.Re.push({hf:0,x:a.na[0].x,y:a.na[0].y,wheelDelta:c});if(0<a.Kc)for(d=a.D.length-1;0<=d&&!((g=a.D[d])&&g.i&&0>=g.I&&g.mn&&(g=g.mn(c,a.na[0].x,a.na[0].y),!0===g));d-=1);}}function Bb(a){return I.na[a].x}
function tb(a,b){window.addEventListener("keydown",function(a){0<b.I||(-1<[32,37,38,39,40].indexOf(a.keyCode)&&a.preventDefault(),Cb(b,a.keyCode))},!1);window.addEventListener("keyup",function(a){0<b.I||(-1<[32,37,38,39,40].indexOf(a.keyCode)&&a.preventDefault(),Db(b,a.keyCode))},!1);Eb(a)}function Eb(a){var b;a.bh=[];for(b=0;256>b;b+=1)a.bh[b]=!1;a.ag=[]}
function Cb(a,b){var c,d;if(!a.bh[b]&&(a.ag.push({key:b,jb:!0}),a.bh[b]=!0,0<a.bg))for(c=0;c<a.D.length&&!((d=a.D[c])&&d.i&&0>=d.I&&d.kn&&(d=d.kn(b),!0===d));c+=1);}function Db(a,b){var c,d;if(a.bh[b]&&(a.ag.push({key:b,jb:!1}),a.bh[b]=!1,0<a.bg))for(c=0;c<a.D.length&&!((d=a.D[c])&&d.i&&0>=d.I&&d.ln&&(d=d.ln(b),!0===d));c+=1);}function Gb(){var a=I,b;for(b=0;b<a.ae.length;b+=1)a.ae[b].paused+=1}
function la(a,b){var c,d=I,g,h;void 0===c&&(c=null);d.ph.push({id:a,Ot:b,Rg:c});if(0<d.kh)for(g=0;g<d.D.length&&(!((h=d.D[g])&&h.i&&0>=h.I&&h.nn)||null!==c&&c!==h||(h=h.nn(a,b),!0!==h));g+=1);}
function Hb(a,b){var c=a.Ib[b];c.visible&&(void 0!==c.canvas&&c.canvas!==w.canvas&&w.mb(c.canvas),!1!==w.canvas.$||!0===c.yc)&&(0===c.lp&&(0>=c.I&&(c.ob+=c.Nt*a.Mf/1E3),1===c.Dl&&1===c.El&&0===c.Qa?1===c.alpha?c.f.u(c.ob,c.x,c.y):c.f.ed(c.ob,c.x,c.y,c.alpha):c.f.oa(c.ob,c.x,c.y,c.Dl,c.El,c.Qa,c.alpha)),1===c.lp&&(1===c.Dl&&1===c.El&&0===c.Qa?1===c.alpha?c.font.u(c.text,c.x,c.y):c.font.ed(c.text,c.x,c.y,c.alpha):c.font.oa(c.text,c.x,c.y,c.Dl,c.El,c.Qa,c.alpha)))}
function Ib(a,b){var c=a.D[b];if(c.visible&&(void 0!==c.canvas&&c.canvas!==w.canvas&&w.mb(c.canvas),(!1!==w.canvas.$||!0===c.yc)&&c.bb))return c.bb()}function Jb(a){for(var b=0,c=0;b<a.D.length||c<a.Ib.length;)if(c===a.Ib.length){if(!0===Ib(a,b))break;b+=1}else if(b===a.D.length)Hb(a,c),c+=1;else if(a.Ib[c].ya>a.D[b].ya||a.Ib[c].ya===a.D[b].ya&&a.Ib[c].depth>a.D[b].depth)Hb(a,c),c+=1;else{if(!0===Ib(a,b))break;b+=1}}qb.prototype.pause=function(a){this.I+=1;void 0===a&&(a=!1);this.op=a};
qb.prototype.Ai=function(){0!==this.I&&(this.kk=Date.now(),this.I-=1)};qb.prototype.br=function(){return 0<this.I};window.Hl=0;window.Gl=0;window.gp=0;window.At=0;window.hp=0;window.Ct=60;window.Dt=0;window.Bt=!1;
window.fp=function(){window.Hl=Date.now();window.At=window.Hl-window.Gl;var a=I,b;if(0<a.I)a.op&&(Kb(a),Jb(a));else{b=Date.now();"number"!==typeof b&&(b=a.kk);a.Mf=Math.min(a.Fv,b-a.kk);a.le+=a.Mf;""===a.hc&&(a.hc="start",ia.td(a.hc));"start"===a.hc&&ia.complete(a.hc)&&(a.hc="load",ia.td(a.hc));"load"===a.hc&&ia.complete(a.hc)&&(a.hc="game",ia.td(a.hc));"undefined"!==typeof H&&Ta(a.Mf);var c,d;if(0<a.gh)for(c=0;c<a.D.length&&!((d=a.D[c])&&d.wa&&d.i&&0>=d.I&&!0===d.wa(a.Mf));c+=1);var g,h;if(0!==a.Zg.length){if(0<
a.hh)for(d=a.D.length-1;0<=d;d-=1)if((g=a.D[d])&&g.i&&0>=g.I&&g.hn)for(c=0;c<a.Zg.length;c+=1)h=a.Zg[c],!0!==h.zc&&(h.zc=g.hn(h.x,h.y));a.Zg=[]}if(0!==a.Re.length){if(0<a.zd)for(d=a.D.length-1;0<=d;d-=1)if((g=a.D[d])&&g.i&&0>=g.I&&(g.ub||g.Cb||g.bk))for(c=0;c<a.Re.length;c+=1)h=a.Re[c],!0!==h.zc&&(void 0!==h.wheelDelta&&g.bk?h.zc=g.bk(h.wheelDelta,h.x,h.y):h.jb&&g.ub?h.zc=g.ub(h.hf,h.x,h.y):void 0!==h.jb&&!h.jb&&g.Cb&&(h.zc=g.Cb(h.hf,h.x,h.y)));a.Re=[]}if(0!==a.ag.length){if(0<a.lh)for(d=0;d<a.D.length;d+=
1)if((g=a.D[d])&&g.i&&0>=g.I&&(g.ak||g.vg))for(c=0;c<a.ag.length;c+=1)h=a.ag[c],!0!==h.zc&&(h.jb&&g.ak?h.zc=void 0:!h.jb&&g.vg&&(h.zc=g.vg(h.key)));a.ag=[]}c=a.Mf;for(d=a.Xg.length=0;d<a.ae.length;d+=1)g=a.ae[d],void 0!==g.id&&0===g.paused&&(0<g.Og||0<g.io)&&(g.Og-=c,0>=g.Og&&(a.Xg.push({id:g.id,Rg:g.Rg}),0<g.io?(g.io-=1,g.Og+=g.time):g.Og=0));if(0<a.fh&&0<a.Xg.length)for(c=0;c<a.D.length;c+=1)if((d=a.D[c])&&d.gn&&d.i)for(g=0;g<a.Xg.length;g+=1)h=a.Xg[g],!0===h.zc||null!==h.Rg&&h.Rg!==d||(h.zc=d.gn(h.id));
if(0<a.mh&&0<a.ph.length)for(c=0;c<a.D.length;c+=1)if((g=a.D[c])&&g.Qc&&g.i&&0>=g.I)for(d=0;d<a.ph.length;d+=1)h=a.ph[d],!0===h.zc||null!==h.Rg&&h.Rg!==g||(h.zc=g.Qc(h.id,h.Ot));a.ph.length=0;if(0<a.ih)for(c=0;c<a.D.length&&!((d=a.D[c])&&d.od&&d.i&&0>=d.I&&!0===d.od(a.Mf));c+=1);Kb(a);Jb(a);a.kk=b}window.Gl=Date.now();window.gp=window.Gl-window.Hl;window.hp=Math.max(window.Dt,1E3/window.Ct-window.gp);window.Ui(window.fp)};window.Ui=function(a){window.setTimeout(a,window.hp)};
window.Bt||(window.Ui=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.msRequestAnimationFrame||window.oRequestAnimationFrame||window.Ui);
function Kb(a){function b(a,b){return a.ya===b.ya?b.depth-a.depth:a.ya>b.ya?-1:1}var c,d;for(c=d=0;c<a.D.length;c+=1)a.D[c]&&(a.D[c].Il&&(a.D[c].Il=!1,a.D[c].i=!0),a.D[d]=a.D[c],d+=1);a.D.length=d;a.qh&&a.D.sort(b);a.qh=!1;for(c=d=0;c<a.Ib.length;c+=1)a.Ib[c]&&(a.Ib[d]=a.Ib[c],d+=1);a.Ib.length=d;a.Jl&&a.Ib.sort(b);a.Jl=!1}
function J(a,b){var c=I;void 0===a.group&&(a.group=0);void 0===a.visible&&(a.visible=!0);void 0===a.i&&(a.i=!0);void 0===a.depth&&(a.depth=0);void 0===a.ya&&(a.ya=0);void 0===a.I&&(a.I=0);void 0===a.Qe&&(a.Qe=[]);a.Il=!1;void 0!==b&&!1===b&&(a.Il=!0,a.i=!1);c.D.push(a);c.qh=!0;a.wa&&(c.gh+=1);a.hn&&(c.hh+=1);if(a.ub||a.Cb)c.zd+=1;a.bk&&(c.zd+=1);if(a.ak||a.vg)c.lh+=1;a.gn&&(c.fh+=1);a.Qc&&(c.mh+=1);a.od&&(c.ih+=1);a.jn&&(c.jh+=1);if(a.sg||a.ug)c.Kc+=1;a.mn&&(c.Kc+=1);if(a.kn||a.ln)c.bg+=1;a.nn&&(c.kh+=
1);a.ec&&a.ec()}function Lb(a,b){var c=I;a.depth!==b&&(c.qh=!0);a.depth=b}function Mb(a,b){var c;b=[].concat(b);void 0===a.Qe&&(a.Qe=[]);for(c=b.length-1;0<=c;c-=1)0>a.Qe.indexOf(b[c])&&a.Qe.push(b[c])}
function Nb(a,b){var c=[],d,g;if(void 0===b||"all"===b||"master"===b)for(d=0;d<a.D.length;d+=1)g=a.D[d],void 0!==g&&c.push(g);else if("function"===typeof b)for(d=0;d<a.D.length;d+=1)g=a.D[d],void 0!==g&&b(g)&&c.push(g);else for(d=0;d<a.D.length;d+=1)g=a.D[d],void 0!==g&&0<=g.Qe.indexOf(b)&&c.push(g);return c}function Ob(a){var b=Nb(I,a);for(a=0;a<b.length;a+=1){var c=b[a];c.I+=1}}function Pb(a){var b=Nb(I,a);for(a=0;a<b.length;a+=1){var c=b[a];c.I=Math.max(0,c.I-1)}}
function K(a,b){var c=a.D.indexOf(b);if(!(0>c)){a.D[c].Yb&&a.D[c].Yb();var d=a.D[c];d.wa&&(a.gh-=1);d.hn&&(a.hh-=1);if(d.ub||d.Cb)a.zd-=1;d.bk&&(a.zd-=1);if(d.ak||d.vg)a.lh-=1;d.gn&&(a.fh-=1);d.Qc&&(a.mh-=1);d.od&&(a.ih-=1);d.jn&&(a.jh-=1);if(d.sg||d.ug)a.Kc-=1;d.mn&&(a.Kc-=1);if(d.kn||d.ln)a.bg-=1;d.nn&&(a.kh-=1);a.D[c]=void 0}}
qb.prototype.e=function(a,b,c,d,g,h,k){void 0===k&&(k=0);this.Ib.push({lp:0,f:a,ob:b,Nt:c,visible:!0,x:d,y:g,Dl:1,El:1,Qa:0,alpha:1,depth:h,ya:k,I:0,Qe:[]});this.Jl=!0;return this.Ib[this.Ib.length-1]};var I=new qb(aa);
function Qb(a,b){var c;this.kind=a;this.A=null;switch(this.kind){case 0:this.A={x:[b.x],y:[b.y]};this.Da=b.x;this.Ra=b.y;this.Xa=b.x;this.rb=b.y;break;case 2:this.A={x:[b.x,b.x+b.pb-1,b.x+b.pb-1,b.x,b.x],y:[b.y,b.y,b.y+b.tb-1,b.y+b.tb-1,b.y]};this.Da=b.x;this.Ra=b.y;this.Xa=b.x+b.pb-1;this.rb=b.y+b.tb-1;break;case 3:this.A={x:[],y:[]};this.Da=b.x-b.$k;this.Ra=b.y-b.$k;this.Xa=b.x+b.$k;this.rb=b.y+b.$k;break;case 1:this.A={x:[b.$o,b.ap],y:[b.bp,b.cp]};this.Da=Math.min(b.$o,b.ap);this.Ra=Math.min(b.bp,
b.cp);this.Xa=Math.max(b.$o,b.ap);this.rb=Math.max(b.bp,b.cp);break;case 4:this.A={x:[],y:[]};this.Da=b.x[0];this.Ra=b.y[0];this.Xa=b.x[0];this.rb=b.y[0];for(c=0;c<b.x.length;c+=1)this.A.x.push(b.x[c]),this.A.y.push(b.y[c]),this.Da=Math.min(this.Da,b.x[c]),this.Ra=Math.min(this.Ra,b.y[c]),this.Xa=Math.max(this.Xa,b.x[c]),this.rb=Math.max(this.rb,b.y[c]);this.A.x.push(b.x[0]);this.A.y.push(b.y[0]);break;default:this.Ra=this.Da=0,this.rb=this.Xa=-1}}
function Sb(a,b,c,d){return new Qb(2,{x:a,y:b,pb:c,tb:d})}function Tb(a){var b=1E6,c=-1E6,d=1E6,g=-1E6,h,k,l,n,q;for(h=0;h<a.L;h+=1)k=a.Wd[h]-a.zb,l=k+a.Vd[h]-1,n=a.Xd[h]-a.Ab,q=n+a.Ud[h]-1,k<b&&(b=k),l>c&&(c=l),n<d&&(d=n),q>g&&(g=q);return new Qb(2,{x:b,y:d,pb:c-b+1,tb:g-d+1})}e=Qb.prototype;
e.M=function(){var a=new Qb(-1,{}),b;a.kind=this.kind;a.Da=this.Da;a.Xa=this.Xa;a.Ra=this.Ra;a.rb=this.rb;a.A={x:[],y:[]};for(b=0;b<this.A.x.length;b+=1)a.A.x[b]=this.A.x[b];for(b=0;b<this.A.y.length;b+=1)a.A.y[b]=this.A.y[b];return a};e.translate=function(a,b){var c=this.M(),d;c.Da+=a;c.Xa+=a;c.Ra+=b;c.rb+=b;for(d=0;d<c.A.x.length;d+=1)c.A.x[d]+=a;for(d=0;d<c.A.y.length;d+=1)c.A.y[d]+=b;return c};
e.scale=function(a){var b=this.M(),c;b.Da*=a;b.Xa*=a;b.Ra*=a;b.rb*=a;for(c=0;c<b.A.x.length;c+=1)b.A.x[c]*=a;for(c=0;c<b.A.y.length;c+=1)b.A.y[c]*=a;return b};
e.rotate=function(a){var b,c,d,g;switch(this.kind){case 0:return b=new p(this.A.x[0],this.A.y[0]),b=b.rotate(a),new Qb(0,{x:b.x,y:b.y});case 1:return b=new p(this.A.x[0],this.A.y[0]),b=b.rotate(a),c=new p(this.A.x[1],this.A.y[1]),c=c.rotate(a),new Qb(1,{$o:b.x,bp:b.y,ap:c.x,cp:c.y});case 3:return b=(this.Xa-this.Da)/2,c=new p(this.Da+b,this.Ra+b),c=c.rotate(a),new Qb(3,{x:c.x,y:c.y,$k:b});default:c=[];d=[];for(g=0;g<this.A.x.length-1;g+=1)b=new p(this.A.x[g],this.A.y[g]),b=b.rotate(a),c.push(b.x),
d.push(b.y);return new Qb(4,{x:c,y:d})}};
function Ub(a,b,c,d,g){var h,k,l,n,q;if(d<b+a.Da||d>b+a.Xa||g<c+a.Ra||g>c+a.rb)return!1;switch(a.kind){case 0:case 2:return!0;case 3:return l=(a.Xa-a.Da)/2,d-=b+a.Da+l,g-=c+a.Ra+l,d*d+g*g<=l*l;case 1:return l=b+a.A.x[0],n=c+a.A.y[0],b+=a.A.x[1],a=c+a.A.y[1],d===l?g===n:d===b?g===a:1>Math.abs(n+(d-l)*(a-n)/(b-l)-g);case 4:n=new p(0,0);q=new p(0,0);l=[];for(k=0;k<a.A.x.length-1;k+=1)n.x=a.A.x[k],n.y=a.A.y[k],q.x=a.A.x[k+1],q.y=a.A.y[k+1],l.push(ea(da(n,q)));for(n=0;n<l.length;n+=1){q=new p(d,g);k=l[n];
q=q.x*k.x+q.y*k.y;h=a;var v=b,D=c,A=l[n],r=new p(0,0),s=void 0,t=1E9;k=-1E10;for(var u=void 0,u=0;u<h.A.x.length;u+=1)r.x=v+h.A.x[u],r.y=D+h.A.y[u],s=r.x*A.x+r.y*A.y,t=Math.min(t,s),k=Math.max(k,s);h=t;if(q<h||k<q)return!1}return!0;default:return!1}}
e.sb=function(a,b,c){var d=w.context;d.fillStyle=c;d.strokeStyle=c;switch(this.kind){case 0:d.fillRect(a+this.Da-1,b+this.Ra-1,3,3);break;case 2:d.fillRect(a+this.Da,b+this.Ra,this.Xa-this.Da+1,this.rb-this.Ra+1);break;case 3:c=(this.Xa-this.Da)/2;d.beginPath();d.arc(a+this.Da+c,b+this.Ra+c,c,0,2*Math.PI,!1);d.closePath();d.fill();break;case 1:d.beginPath();d.moveTo(a+this.A.x[0],b+this.A.y[0]);d.lineTo(a+this.A.x[1],b+this.A.y[1]);d.stroke();break;case 4:d.beginPath();d.moveTo(a+this.A.x[0],b+this.A.y[0]);
for(c=1;c<this.A.x.length-1;c+=1)d.lineTo(a+this.A.x[c],b+this.A.y[c]);d.closePath();d.fill()}};function Vb(){this.depth=1E7;this.visible=!1;this.i=!0;this.group="Engine";this.fa=[];this.eh=this.I=this.oh=!1;this.ce=1;this.oc=-1;this.ma=-1E6}e=Vb.prototype;e.M=function(){var a=new Vb,b;for(b=0;b<this.fa.length;b+=1)a.fa.push({Va:this.fa[b].Va,action:this.fa[b].action});a.eh=this.eh;return a};
e.ua=function(a,b){var c,d;if(0===this.fa.length||this.fa[this.fa.length-1].Va<=a)this.fa.push({Va:a,action:b});else{for(c=0;this.fa[c].Va<=a;)c+=1;for(d=this.fa.length;d>c;d-=1)this.fa[d]=this.fa[d-1];this.fa[c]={Va:a,action:b}}this.ma=-1E6};e.start=function(){this.oh=!0;this.I=!1;this.oc=0>this.ce&&0<this.fa.length?this.fa[this.fa.length-1].Va+1:-1;this.ma=-1E6;K(I,this);J(this)};
e.jo=function(){if(0>this.ce&&0<this.fa.length){var a=this.fa[this.fa.length-1].Va;this.oc=0>this.ce?a+1:a-1}else this.oc=0>this.ce?1:-1;this.ma=-1E6};e.stop=function(){this.oh=!1;K(I,this)};e.Qd=function(){return this.oh};e.pause=function(){this.I=!0;K(I,this)};e.Ai=function(){this.I=!1;K(I,this);J(this)};e.paused=function(){return this.oh&&this.I};e.fl=function(a){this.eh=a};
e.wa=function(a){if(this.oh&&!this.I&&0!==this.ce)if(0<this.ce){0>this.ma&&(this.ma=0);for(;this.ma<this.fa.length&&this.fa[this.ma].Va<=this.oc;)this.ma+=1;for(this.oc+=this.ce*a;0<=this.ma&&this.ma<this.fa.length&&this.fa[this.ma].Va<=this.oc;)this.fa[this.ma].action(this.fa[this.ma].Va,this),this.ma+=1;this.ma>=this.fa.length&&(this.eh?this.jo():this.stop())}else{0>this.ma&&(this.ma=this.fa.length-1);for(;0<=this.ma&&this.fa[this.ma].Va>=this.oc;)this.ma-=1;for(this.oc+=this.ce*a;0<=this.ma&&this.fa[this.ma].Va>=
this.oc;)this.fa[this.ma].action(this.fa[this.ma].Va,this),this.ma-=1;0>this.ma&&0>=this.oc&&(this.eh?this.jo():this.stop())}};function Wb(){this.depth=1E7;this.visible=!1;this.i=!0;this.group="Engine";this.Hb=[];this.Me=[];this.clear();this.Yw=!1;J(this)}e=Wb.prototype;e.wa=function(){var a,b,c,d,g;if(this.Yw)for(a=0;16>a;a+=1)I.na[a].jb&&(b=Bb(a),c=I.na[a].y,d=this.Me[a],g=this.Hb[d],!(0<=d&&g&&g.selected)||g&&Ub(g.Ac,0,0,b,c)||(Db(I,g.keyCode),g.selected=!1,this.Me[a]=-1),this.ub(a,b,c))};
e.ub=function(a,b,c){var d;if(!(0<=this.Me[a]))for(d=0;d<this.Hb.length;d+=1){var g;if(g=this.Hb[d])g=(g=this.Hb[d])?Ub(g.Ac,0,0,b,c):!1;if(g&&!this.Hb[d].selected){Cb(I,this.Hb[d].keyCode);this.Hb[d].selected=!0;this.Me[a]=d;break}}};e.Cb=function(a){var b=this.Me[a];0<=b&&this.Hb[b]&&this.Hb[b].selected&&(Db(I,this.Hb[b].keyCode),this.Hb[b].selected=!1);this.Me[a]=-1};function Xb(a,b,c,d,g,h,k){c=Sb(c,d,g,h);a.Hb.push({keyCode:k,Ac:c,id:b,selected:!1})}
e.clear=function(){var a;for(a=this.Hb.length=0;16>a;a+=1)this.Me[a]=-1};e.sb=function(a,b,c){var d,g,h,k;for(d=0;d<this.Hb.length;d+=1)if(g=this.Hb[d])g.selected?g.Ac.sb(0,0,b):g.Ac.sb(0,0,a),h=(g.Ac.Da+g.Ac.Xa)/2,k=(g.Ac.Ra+g.Ac.rb)/2,w.cc("id: "+g.id,h-20,k-10,c,"16px Arial"),w.cc("key: "+g.keyCode,h-20,k+10,c,"16px Arial")};new fa;function Yb(a,b){return b}function M(a,b,c,d){return b+a/d*c}function Zb(a,b,c,d,g){void 0===g&&(g=3);return b+c*Math.pow(a/d,g)}
function $b(a,b,c,d){return Zb(a,b,c,d,2)}function ac(a,b,c,d){return b+c*Zb(d-a,1,-1,d,2)}function bc(a,b,c,d){return Zb(a,b,c,d,3)}function N(a,b,c,d){return b+c*Zb(d-a,1,-1,d,3)}function cc(a,b,c,d){return b+c*(a<d/2?Zb(a,0,.5,d/2,3):Zb(d-a,1,-.5,d/2,3))}function dc(a,b,c,d,g){var h;void 0===g&&(g=8);h=Math.pow(2,-g);return b+(Math.pow(2,g*a/d-g)-h)/(1-h)*c}
function ec(a,b,c,d,g){a=d-a;var h=3;void 0===h&&(h=3);void 0===g&&(g=8);h=Math.sin(2*(1-a/d)*Math.PI*h+Math.PI/2);h*=dc(a,0,1,d,g);return b+c*(1+-1*h)}function fc(a,b,c,d,g){void 0===g&&(g=1.70158);return b+c*((1+g)*Math.pow(a/d,3)-g*Math.pow(a/d,2))}function gc(a,b,c,d,g){return b+c*fc(d-a,1,-1,d,g)}
function hc(a){switch(1){case 0:return function(b,c,d,g,h,k,l){return 0>b?c:b>g?c+d:a(b,c,d,g,h,k,l)};case 1:return function(b,c,d,g,h,k,l){return a(b-Math.floor(b/g)*g,c,d,g,h,k,l)};case 2:return function(b,c,d,g,h,k,l){b=0===Math.floor(b/g)%2?a(b-Math.floor(b/g)*g,0,1,g,h,k,l):a(g-b+Math.floor(b/g)*g,0,1,g,h,k,l);return c+d*b};case 3:return function(b,c,d,g,h,k,l){h=a(b-Math.floor(b/g)*g,0,1,g,h,k,l);0!==Math.floor(b/g)%2&&(h=1-h);return c+d*h};case 4:return function(b,c,d,g,h,k,l){var n=Math.floor(b/
g);b=a(b-Math.floor(b/g)*g,0,1,g,h,k,l);return c+d*(n+b)};case 5:return function(b,c,d,g,h,k,l){var n=Math.floor(b/g);b=0===Math.floor(b/g)%2?a(b-Math.floor(b/g)*g,0,1,g,h,k,l):a(g-b+Math.floor(b/g)*g,1,-1,g,h,k,l);return c+d*(n+b)};default:return function(b,c,d,g,h,k,l){return a(b,c,d,g,h,k,l)}}}
function ic(a,b,c){var d,g=0,h=1,k=[0],l=[0];for(void 0===b&&(b=[]);b.length<a.length;)b.push(!1);for(void 0===c&&(c=[]);c.length<a.length;)c.push(1/a.length);for(d=0;d<a.length;d+=1)g+=c[d];for(d=0;d<a.length;d+=1)c[d]/=g;for(d=0;d<a.length;d+=1)l.push(l[d]+c[d]),g=a[d]===Yb?0:b[d]?-1:1,k.push(k[d]+g),h=Math.max(h,k[d+1]);return function(d,g,v,D,A,r,s){var t,u;t=a.length-1;for(u=0;u<a.length;u+=1)if(d/D<=l[u+1]){t=u;break}d=a[t](d/D-l[t],0,1,c[t],A,r,s);b[t]&&(d=-d);return g+(k[t]+d)*v/h}}
var O=window.TG_InitSettings||{};O.size=void 0!==O.size?O.size:"big";O.pt=O.usesFullScreen;O.lo="big"===O.size?1:.5;O.lf=20;O.mf=10;O.zq=0;O.Wj=-10;O.qg=-20;O.Xb=-30;O.Jd=-40;
function P(a,b){var c;if("number"===typeof a){a:switch(b){case "floor":c=Math.floor(O.lo*a);break a;case "round":c=Math.round(O.lo*a);break a;default:c=O.lo*a}return c}if("[object Array]"===Object.prototype.toString.call(a)){for(c=0;c<a.length;c++)a[c]=P(a[c],b);return a}if("object"===typeof a){for(c in a)a.hasOwnProperty(c)&&(a[c]=P(a[c],b));return a}}function Q(a){return"big"===O.size?void 0!==a.big?a.big:a:void 0!==a.small?a.small:a}window.throbber=new mb("throbber","media/throbber.png");
window.TG_StartScreenLogo=new mb("TG_StartScreenLogo","../logos/TG_StartScreenLogo.png");var jc=new ra("StartTexture",2,"start");window.StartTexture=jc;sa(jc,0,"media/StartTexture0.png");sa(jc,1,"media/StartTexture1.png");var kc=new ra("StartScreenTexture",1,"load");window.StartScreenTexture=kc;sa(kc,0,"media/StartScreenTexture0.png");var lc=new ra("LevelMapScreenTexture",1,"load");window.LevelMapScreenTexture=lc;sa(lc,0,"media/LevelMapScreenTexture0.png");var mc=new ra("LevelEndTexture",2,"load");
window.LevelEndTexture=mc;sa(mc,0,"media/LevelEndTexture0.png");sa(mc,1,"media/LevelEndTexture1.png");var S=new ra("MenuTexture",2,"load");window.MenuTexture=S;sa(S,0,"media/MenuTexture0.png");sa(S,1,"media/MenuTexture1.png");var nc=new ra("GameTexture",2,"load");window.GameTexture=nc;sa(nc,0,"media/GameTexture0.png");sa(nc,1,"media/GameTexture1.png");var oc=new ra("GameStaticTexture",1,"load");window.GameStaticTexture=oc;sa(oc,0,"media/GameStaticTexture0.png");
var pc=new x("s_loadingbar_background",kc,1,42,32,0,0,42,32,1);window.s_loadingbar_background=pc;pc.e(0,0,937,1,42,32,0,0);var qc=new x("s_level_0",lc,1,125,140,0,0,125,140,1);window.s_level_0=qc;qc.e(0,0,129,1,125,140,0,0);var rc=new x("s_level_1",lc,1,125,140,0,0,125,140,1);window.s_level_1=rc;rc.e(0,0,257,1,125,140,0,0);var sc=new x("s_level_2",lc,1,125,140,0,0,125,140,1);window.s_level_2=sc;sc.e(0,0,1,1,125,140,0,0);var tc=new x("s_level_3",lc,1,125,140,0,0,125,140,1);window.s_level_3=tc;
tc.e(0,0,385,1,125,140,0,0);var uc=new x("s_level_lock",lc,1,48,70,0,0,48,70,1);window.s_level_lock=uc;uc.e(0,0,777,113,48,69,0,1);var vc=new x("s_level_stars",lc,1,126,46,0,0,126,46,1);window.s_level_stars=vc;vc.e(0,0,513,1,126,45,0,1);var wc=new x("s_level2_0",lc,1,84,87,0,0,84,87,1);window.s_level2_0=wc;wc.e(0,0,897,97,84,87,0,0);var xc=new x("s_level2_1",lc,1,84,87,0,0,84,87,1);window.s_level2_1=xc;xc.e(0,0,897,1,84,87,0,0);var yc=new x("s_level2_2",lc,1,84,87,0,0,84,87,1);window.s_level2_2=yc;
yc.e(0,0,601,113,84,87,0,0);var zc=new x("s_level2_3",lc,1,84,87,0,0,84,87,1);window.s_level2_3=zc;zc.e(0,0,513,49,84,87,0,0);var Ac=new x("s_level2_arrow_right",lc,2,60,108,0,0,60,216,1);window.s_level2_arrow_right=Ac;Ac.e(0,0,833,1,60,108,0,0);Ac.e(1,0,641,1,60,108,0,0);var Bc=new x("s_level2_arrow_left",lc,2,60,108,0,0,60,216,1);window.s_level2_arrow_left=Bc;Bc.e(0,0,705,1,60,108,0,0);Bc.e(1,0,769,1,60,108,0,0);var Cc=new x("s_level2_lock",lc,1,84,87,0,0,84,87,1);window.s_level2_lock=Cc;
Cc.e(0,0,689,113,84,87,0,0);var Dc=new x("s_pop_medal",mc,8,378,378,189,189,3024,378,8);window.s_pop_medal=Dc;Dc.e(0,0,601,1,349,241,3,69);Dc.e(1,0,601,529,346,267,5,54);Dc.e(2,0,601,249,348,276,20,56);Dc.e(3,1,1,1,342,288,26,50);Dc.e(4,1,689,1,319,292,22,46);Dc.e(5,1,1,297,337,304,14,41);Dc.e(6,0,1,641,343,305,12,41);Dc.e(7,1,345,1,341,304,13,41);var Ec=new x("s_medal_shadow",mc,1,195,208,0,0,195,208,1);window.s_medal_shadow=Ec;Ec.e(0,1,745,513,189,204,3,1);
var Fc=new x("s_medal_shine",mc,6,195,208,0,0,1170,208,6);window.s_medal_shine=Fc;Fc.e(0,1,545,513,193,207,1,1);Fc.e(1,1,345,313,193,207,1,1);Fc.e(2,0,353,641,193,207,1,1);Fc.e(3,1,689,297,193,207,1,1);Fc.e(4,0,553,801,193,207,1,1);Fc.e(5,0,753,801,193,207,1,1);var Gc=new x("s_icon_toggle_hard",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_hard=Gc;Gc.e(0,0,953,345,67,67,0,0);var Hc=new x("s_icon_toggle_medium",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_medium=Hc;Hc.e(0,0,953,417,67,67,0,0);
var Ic=new x("s_icon_toggle_easy",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_easy=Ic;Ic.e(0,0,937,489,67,67,0,0);var Jc=new x("s_flagIcon_us",S,1,48,48,0,0,48,48,1);window.s_flagIcon_us=Jc;Jc.e(0,0,929,785,48,36,0,6);var Kc=new x("s_flagIcon_gb",S,1,48,48,0,0,48,48,1);window.s_flagIcon_gb=Kc;Kc.e(0,0,929,705,48,36,0,6);var Lc=new x("s_flagIcon_nl",S,1,48,48,0,0,48,48,1);window.s_flagIcon_nl=Lc;Lc.e(0,0,929,745,48,36,0,6);var Mc=new x("s_flagIcon_tr",S,1,48,48,0,0,48,48,1);window.s_flagIcon_tr=Mc;
Mc.e(0,0,521,649,48,36,0,6);var Nc=new x("s_flagIcon_de",S,1,48,48,0,0,48,48,1);window.s_flagIcon_de=Nc;Nc.e(0,0,545,809,48,36,0,6);var Oc=new x("s_flagIcon_fr",S,1,48,48,0,0,48,48,1);window.s_flagIcon_fr=Oc;Oc.e(0,0,601,809,48,36,0,6);var Pc=new x("s_flagIcon_br",S,1,48,48,0,0,48,48,1);window.s_flagIcon_br=Pc;Pc.e(0,0,825,809,48,36,0,6);var Qc=new x("s_flagIcon_es",S,1,48,48,0,0,48,48,1);window.s_flagIcon_es=Qc;Qc.e(0,0,1,841,48,36,0,6);var Rc=new x("s_flagIcon_jp",S,1,48,48,0,0,48,48,1);
window.s_flagIcon_jp=Rc;Rc.e(0,0,937,825,48,36,0,6);var Sc=new x("s_flagIcon_ru",S,1,48,48,0,0,48,48,1);window.s_flagIcon_ru=Sc;Sc.e(0,0,881,825,48,36,0,6);var Tc=new x("s_flagIcon_ar",S,1,48,48,0,0,48,48,1);window.s_flagIcon_ar=Tc;Tc.e(0,0,769,809,48,36,0,6);var Uc=new x("s_flagIcon_kr",S,1,48,48,0,0,48,48,1);window.s_flagIcon_kr=Uc;Uc.e(0,0,713,809,48,36,0,6);var Vc=new x("s_flagIcon_it",S,1,48,48,0,0,48,48,1);window.s_flagIcon_it=Vc;Vc.e(0,0,657,809,48,36,0,6);
var Wc=new x("s_tutorialButton_close",S,1,66,65,0,0,66,65,1);window.s_tutorialButton_close=Wc;Wc.e(0,0,905,633,65,65,0,0);var Xc=new x("s_tutorialButton_next",S,1,66,65,0,0,66,65,1);window.s_tutorialButton_next=Xc;Xc.e(0,0,937,561,66,65,0,0);var Yc=new x("s_tutorialButton_previous",S,1,66,65,0,0,66,65,1);window.s_tutorialButton_previous=Yc;Yc.e(0,0,833,633,66,65,0,0);var Zc=new x("s_logo_tinglygames",S,1,240,240,0,0,240,240,1);window.s_logo_tinglygames=Zc;Zc.e(0,0,601,177,240,240,0,0);
var $c=new x("s_logo_coolgames",S,1,240,240,0,0,240,240,1);window.s_logo_coolgames=$c;$c.e(0,0,601,1,240,167,0,36);var ad=new x("s_logo_tinglygames_start",kc,1,156,54,0,0,156,54,1);window.s_logo_tinglygames_start=ad;ad.e(0,0,625,1,156,53,0,0);var bd=new x("s_logo_coolgames_start",kc,1,300,104,0,0,300,104,1);window.s_logo_coolgames_start=bd;bd.e(0,0,785,1,150,104,75,0);var cd=new x("s_ui_cup_highscore",nc,1,32,28,0,0,32,28,1);window.s_ui_cup_highscore=cd;cd.e(0,0,985,497,32,28,0,0);
var dd=new x("s_ui_cup_score",nc,1,28,24,0,0,28,24,1);window.s_ui_cup_score=dd;dd.e(0,0,985,529,28,24,0,0);var ed=new x("s_ui_divider",oc,1,94,2,0,0,94,2,1);window.s_ui_divider=ed;ed.e(0,0,817,281,94,2,0,0);var fd=new x("s_ui_background_blank",oc,1,140,580,0,0,140,580,1);window.s_ui_background_blank=fd;fd.e(0,0,601,1,140,580,0,0);var gd=new x("s_ui_highscore",oc,1,26,36,13,12,26,36,1);window.s_ui_highscore=gd;gd.e(0,0,993,41,26,36,0,0);var hd=new x("s_ui_timeleft",oc,1,20,26,0,0,20,26,1);
window.s_ui_timeleft=hd;hd.e(0,0,993,81,20,26,0,0);var jd=new x("s_ui_smiley_hard",nc,1,22,22,11,11,22,22,1);window.s_ui_smiley_hard=jd;jd.e(0,0,1001,49,22,22,0,0);var kd=new x("s_ui_smiley_medium",nc,1,22,22,11,11,22,22,1);window.s_ui_smiley_medium=kd;kd.e(0,0,1001,25,22,22,0,0);var ld=new x("s_ui_smiley_easy",nc,1,22,22,11,11,22,22,1);window.s_ui_smiley_easy=ld;ld.e(0,0,1001,1,22,22,0,0);var md=new x("s_ui_crown",nc,1,24,20,12,10,24,20,1);window.s_ui_crown=md;md.e(0,0,985,593,24,20,0,0);
var nd=new x("s_ui_heart",nc,1,28,24,14,12,28,24,1);window.s_ui_heart=nd;nd.e(0,0,985,561,26,23,1,1);var T=new x("s_cards",nc,52,84,110,42,55,84,5720,1);window.s_cards=T;T.e(0,0,905,913,74,102,5,5);T.e(1,1,585,1,74,102,5,5);T.e(2,1,665,1,74,102,5,5);T.e(3,1,745,1,74,102,5,5);T.e(4,1,825,1,74,102,5,5);T.e(5,0,825,913,74,102,5,5);T.e(6,0,745,913,74,102,5,5);T.e(7,1,585,105,74,102,5,5);T.e(8,0,665,809,74,102,5,5);T.e(9,0,745,809,74,102,5,5);T.e(10,0,825,809,74,102,5,5);T.e(11,0,905,809,74,102,5,5);
T.e(12,0,585,849,74,102,5,5);T.e(13,1,905,1,74,102,5,5);T.e(14,1,665,105,74,102,5,5);T.e(15,1,745,313,74,102,5,5);T.e(16,1,905,313,74,102,5,5);T.e(17,1,905,209,74,102,5,5);T.e(18,1,665,313,74,102,5,5);T.e(19,1,825,209,74,102,5,5);T.e(20,1,585,313,74,102,5,5);T.e(21,1,745,209,74,102,5,5);T.e(22,1,665,209,74,102,5,5);T.e(23,1,825,313,74,102,5,5);T.e(24,1,745,105,74,102,5,5);T.e(25,1,825,105,74,102,5,5);T.e(26,1,905,105,74,102,5,5);T.e(27,1,585,209,74,102,5,5);T.e(28,0,665,913,74,102,5,5);
T.e(29,0,745,601,74,102,5,5);T.e(30,0,849,393,74,102,5,5);T.e(31,0,585,433,74,102,5,5);T.e(32,0,745,497,74,102,5,5);T.e(33,0,929,289,74,102,5,5);T.e(34,0,769,393,74,102,5,5);T.e(35,0,689,393,74,102,5,5);T.e(36,0,769,289,74,102,5,5);T.e(37,0,849,289,74,102,5,5);T.e(38,0,689,289,74,102,5,5);T.e(39,0,929,393,74,102,5,5);T.e(40,0,825,497,74,102,5,5);T.e(41,0,585,537,74,102,5,5);T.e(42,0,585,641,74,102,5,5);T.e(43,0,745,705,74,102,5,5);T.e(44,0,905,705,74,102,5,5);T.e(45,0,665,705,74,102,5,5);
T.e(46,0,905,601,74,102,5,5);T.e(47,0,665,497,74,102,5,5);T.e(48,0,905,497,74,102,5,5);T.e(49,0,665,601,74,102,5,5);T.e(50,0,825,601,74,102,5,5);T.e(51,0,825,705,74,102,5,5);var pd=new x("s_card_shadow",nc,1,84,110,42,55,84,110,1);window.s_card_shadow=pd;pd.e(0,1,209,329,72,100,6,5);var qd=new x("s_card_position_stock",nc,1,84,110,42,55,84,110,1);window.s_card_position_stock=qd;qd.e(0,1,289,329,72,100,6,5);var rd=new x("s_card_position_waste",nc,1,84,110,42,55,84,110,1);
window.s_card_position_waste=rd;rd.e(0,1,529,417,72,100,6,5);var sd=new x("s_card_position_pile",nc,1,84,110,42,55,84,110,1);window.s_card_position_pile=sd;sd.e(0,1,449,329,72,100,6,5);var td=new x("s_card_position_foundation",nc,1,84,110,42,55,84,110,1);window.s_card_position_foundation=td;td.e(0,1,369,329,72,100,6,5);var ud=new x("s_card_dust",nc,9,120,160,60,80,1080,160,9);window.s_card_dust=ud;ud.e(0,0,689,145,110,136,5,12);ud.e(1,0,801,145,110,136,5,12);ud.e(2,0,913,145,110,136,5,12);
ud.e(3,0,585,289,100,136,10,12);ud.e(4,0,585,1,102,138,9,11);ud.e(5,0,689,1,102,138,9,11);ud.e(6,0,793,1,102,138,9,11);ud.e(7,0,897,1,102,138,9,11);ud.e(8,0,585,145,102,138,9,11);var vd=new x("s_btn_small_undo",oc,2,100,92,0,0,200,92,2);window.s_btn_small_undo=vd;vd.e(0,0,921,185,100,92,0,0);vd.e(1,0,817,185,100,92,0,0);var wd=new x("s_tutorial_01",oc,1,350,190,0,0,350,190,1);window.s_tutorial_01=wd;wd.e(0,0,345,585,317,141,17,12);var xd=new x("s_tutorial_02",oc,1,350,190,0,0,350,190,1);
window.s_tutorial_02=xd;xd.e(0,0,745,1,241,178,55,6);var yd=new x("s_tutorial_03",oc,1,350,190,0,0,350,190,1);window.s_tutorial_03=yd;yd.e(0,0,745,185,67,180,156,5);var zd=new x("s_tutorial_04",oc,1,350,190,0,0,350,190,1);window.s_tutorial_04=zd;zd.e(0,0,1,529,341,186,4,1);var Ad=new x("s_tutorial_05",oc,1,350,190,0,0,350,190,1);window.s_tutorial_05=Ad;Ad.e(0,0,665,585,286,187,38,2);var Bd=new x("s_icon_toggle_sfx_on",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_sfx_on=Bd;
Bd.e(0,0,465,649,49,31,7,17);var Cd=new x("s_icon_toggle_sfx_off",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_sfx_off=Cd;Cd.e(0,0,969,257,53,31,7,17);var Dd=new x("s_icon_toggle_music_on",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_music_on=Dd;Dd.e(0,0,977,193,38,41,13,16);var Ed=new x("s_icon_toggle_music_off",S,1,67,67,0,0,67,67,1);window.s_icon_toggle_music_off=Ed;Ed.e(0,0,969,297,51,41,8,16);var Fd=new x("s_btn_small_exit",S,2,100,92,0,0,200,92,2);window.s_btn_small_exit=Fd;
Fd.e(0,0,233,745,100,92,0,0);Fd.e(1,0,849,345,100,92,0,0);var Gd=new x("s_btn_small_pause",nc,2,100,92,0,0,200,92,2);window.s_btn_small_pause=Gd;Gd.e(0,1,1,329,100,92,0,0);Gd.e(1,1,105,329,100,92,0,0);var Hd=new x("s_btn_small_options",S,2,100,92,0,0,200,92,2);window.s_btn_small_options=Hd;Hd.e(0,0,833,441,100,92,0,0);Hd.e(1,0,833,537,100,92,0,0);var Id=new x("s_btn_small_retry",mc,2,100,92,0,0,200,92,2);window.s_btn_small_retry=Id;Id.e(0,1,889,297,100,92,0,0);Id.e(1,1,545,313,100,92,0,0);
var Jd=new x("s_btn_standard",S,2,96,92,0,0,192,92,2);window.s_btn_standard=Jd;Jd.e(0,0,337,745,96,92,0,0);Jd.e(1,0,441,809,96,92,0,0);var Kd=new x("s_btn_toggle",S,2,162,92,0,0,324,92,2);window.s_btn_toggle=Kd;Kd.e(0,0,849,97,162,92,0,0);Kd.e(1,0,849,1,162,92,0,0);var Ld=new x("s_icon_toggle_fxoff",S,2,227,92,0,0,454,92,2);window.s_icon_toggle_fxoff=Ld;Ld.e(0,0,601,425,227,92,0,0);Ld.e(1,0,233,649,227,92,0,0);var Md=new x("s_icon_toggle_fxon",S,2,227,92,0,0,454,92,2);window.s_icon_toggle_fxon=Md;
Md.e(0,0,601,521,227,92,0,0);Md.e(1,0,601,617,227,92,0,0);var Nd=new x("s_icon_toggle_musicoff",S,2,227,92,0,0,454,92,2);window.s_icon_toggle_musicoff=Nd;Nd.e(0,0,1,649,227,92,0,0);Nd.e(1,0,465,713,227,92,0,0);var Od=new x("s_icon_toggle_musicon",S,2,227,92,0,0,454,92,2);window.s_icon_toggle_musicon=Od;Od.e(0,0,697,713,227,92,0,0);Od.e(1,0,1,745,227,92,0,0);var Pd=new x("s_btn_big_start",mc,2,154,152,0,0,308,152,2);window.s_btn_big_start=Pd;Pd.e(0,1,161,609,154,152,0,0);Pd.e(1,1,1,609,154,152,0,0);
var Qd=new x("s_btn_big_restart",mc,2,154,152,0,0,308,152,2);window.s_btn_big_restart=Qd;Qd.e(0,0,353,857,154,152,0,0);Qd.e(1,1,345,529,154,152,0,0);var Rd=new x("s_overlay_assignment",oc,1,592,520,0,0,592,520,1);window.s_overlay_assignment=Rd;Rd.e(0,0,1,1,591,519,1,1);var Sd=new x("s_tutorial",S,1,522,562,0,0,522,562,1);window.s_tutorial=Sd;Sd.e(0,1,1,1,522,562,0,0);var Td=new x("s_screen_start",jc,4,576,320,0,0,1152,640,2);window.s_screen_start=Td;Td.e(0,0,1,329,576,320,0,0);
Td.e(1,1,1,1,576,320,0,0);Td.e(2,0,1,1,576,320,0,0);Td.e(3,0,1,657,576,320,0,0);var Ud=new x("s_overlay_options",S,1,598,640,0,0,598,640,1);window.s_overlay_options=Ud;Ud.e(0,0,1,1,598,640,0,0);var Vd=new x("s_btn_bigtext",kc,2,137,104,0,0,274,104,2);window.s_btn_bigtext=Vd;Vd.e(0,0,625,57,137,104,0,0);Vd.e(1,0,769,113,137,104,0,0);var Wd=new x("s_overlay_difficulty",mc,1,592,636,0,0,592,636,1);window.s_overlay_difficulty=Wd;Wd.e(0,0,1,1,591,635,1,1);
var Xd=new x("s_background",nc,4,576,320,0,0,1152,640,2);window.s_background=Xd;Xd.e(0,0,1,329,576,320,0,0);Xd.e(1,1,1,1,576,320,0,0);Xd.e(2,0,1,657,576,320,0,0);Xd.e(3,0,1,1,576,320,0,0);var Yd=new x("s_logo",kc,1,620,250,0,0,620,250,1);window.s_logo=Yd;Yd.e(0,0,1,1,619,250,1,0);var Zd=new x("s_card_back",nc,1,84,110,42,55,84,110,1);window.s_card_back=Zd;Zd.e(0,0,585,745,74,102,5,5);var $d=new x("s_ui_solitaire_threecarddraw",oc,1,56,44,0,0,56,44,1);window.s_ui_solitaire_threecarddraw=$d;
$d.e(0,0,913,281,56,43,0,1);var ae=new x("s_ui_solitaire_freeplacement",oc,1,56,44,0,0,56,44,1);window.s_ui_solitaire_freeplacement=ae;ae.e(0,0,817,289,47,37,3,4);var be=new x("s_ui_solitaire_onecarddraw",oc,1,56,44,0,0,56,44,1);window.s_ui_solitaire_onecarddraw=be;be.e(0,0,993,1,26,37,15,4);var ce=new x("s_logo_preload_tinglygames",jc,1,322,54,0,0,322,54,1);window.s_logo_preload_tinglygames=ce;ce.e(0,0,585,1,320,54,0,0);var de=new x("s_loadingbar_bg",jc,1,38,20,0,0,38,20,1);
window.s_loadingbar_bg=de;de.e(0,0,913,1,38,20,0,0);var ee=new x("s_loadingbar_fill",jc,1,30,12,0,0,30,12,1);window.s_loadingbar_fill=ee;ee.e(0,0,953,1,30,12,0,0);var fe=new x("s_logo_about",S,1,121,121,0,0,121,121,1);window.s_logo_about=fe;fe.e(0,0,849,257,117,80,2,21);var ge=new x("s_logo_poki_about",S,1,123,58,0,0,123,58,1);window.s_logo_poki_about=ge;ge.e(0,0,849,193,123,58,0,0);var he=new x("s_logo_poki_start",jc,1,120,60,0,0,120,60,1);window.s_logo_poki_start=he;he.e(0,0,793,57,119,59,1,1);
var ie=new x("s_ads_background",jc,1,200,200,100,100,200,200,1);window.s_ads_background=ie;ie.e(0,0,585,57,200,200,0,0);var je=new ua("f_default","fonts/f_default.woff","fonts/f_default.ttf","fonts");window.f_defaultLoader=je;var U=new ya("f_default","Arial");window.f_default=U;E(U,12);U.fill=!0;U.setFillColor("Black");Aa(U,1);Ca(U,!1);U.setStrokeColor("Black");Ea(U,1);Ga(U,"miter");Da(U,1);Fa(U,!1);F(U,"left");G(U,"top");U.Ka=0;U.ta=0;
var ke=new ua("ff_opensans_extrabold","fonts/ff_opensans_extrabold.woff","fonts/ff_opensans_extrabold.ttf","fonts");window.ff_opensans_extraboldLoader=ke;var le=new ua("ff_dimbo_regular","fonts/ff_dimbo_regular.woff","fonts/ff_dimbo_regular.ttf","fonts");window.ff_dimbo_regularLoader=le;var me=new ua("ff_opensans_bold","fonts/ff_opensans_bold.woff","fonts/ff_opensans_bold.ttf","fonts");window.ff_opensans_boldLoader=me;
var ne=new ua("ff_opensans_bolditalic","fonts/ff_opensans_bolditalic.woff","fonts/ff_opensans_bolditalic.ttf","fonts");window.ff_opensans_bolditalicLoader=ne;var oe=new ya("ff_opensans_bold","Arial");window.f_game_ui_tiny=oe;E(oe,11);oe.fill=!0;oe.setFillColor("#799EC5");Aa(oe,1);Ca(oe,!1);oe.setStrokeColor("White");Ea(oe,1);Ga(oe,"miter");Da(oe,1);Fa(oe,!1);F(oe,"center");G(oe,"middle");oe.Ka=0;oe.ta=0;var V=new ya("ff_opensans_bold","Arial");window.f_game_ui=V;E(V,23);V.fill=!0;V.setFillColor("#799EC5");
Aa(V,1);Ca(V,!1);V.setStrokeColor("Black");Ea(V,1);Ga(V,"miter");Da(V,1);Fa(V,!1);F(V,"center");G(V,"middle");V.Ka=0;V.ta=0;var pe=new ya("ff_opensans_bolditalic","Arial");window.f_game_ui_large=pe;E(pe,52);pe.fill=!0;pe.setFillColor("#172348");Aa(pe,1);Ca(pe,!1);pe.setStrokeColor("Black");Ea(pe,1);Ga(pe,"miter");Da(pe,1);Fa(pe,!1);F(pe,"center");G(pe,"middle");pe.Ka=0;pe.ta=0;var qe=new ua("floaterFontFace","fonts/floaterFontFace.woff","fonts/floaterFontFace.ttf","fonts");
window.floaterFontFaceLoader=qe;var re=new ua("floaterNumberFontFace","fonts/floaterNumberFontFace.woff","fonts/floaterNumberFontFace.ttf","fonts");window.floaterNumberFontFaceLoader=re;var se=new ya("floaterFontFace","Arial");window.floaterFontText1=se;E(se,24);za(se,"normal");se.fill=!0;se.setFillColor("#FFDE00");Aa(se,1);Ca(se,!0);se.setStrokeColor("#6F1F00");Ea(se,4);Ga(se,"miter");Da(se,1);Fa(se,!0);Ha(se,"rgba(57,0,0,0.46)",4);F(se,"left");G(se,"top");se.Ka=0;se.ta=0;
var te=new ya("floaterFontFace","Arial");window.floaterFontText2=te;E(te,28);za(te,"normal");te.fill=!0;Ba(te,2,["#FFF600","#00DB48","blue"],.65,.02);Aa(te,1);Ca(te,!0);te.setStrokeColor("#073400");Ea(te,4);Ga(te,"miter");Da(te,1);Fa(te,!0);Ha(te,"rgba(0,57,43,0.47)",4);F(te,"left");G(te,"top");te.Ka=0;te.ta=0;var ue=new ya("floaterFontFace","Arial");window.floaterFontText3=ue;E(ue,30);za(ue,"normal");ue.fill=!0;Ba(ue,3,["#FFF600","#FF8236","#FF0096"],.71,-.1);Aa(ue,1);Ca(ue,!0);ue.setStrokeColor("#4F0027");
Ea(ue,4);Ga(ue,"miter");Da(ue,1);Fa(ue,!0);Ha(ue,"rgba(41,0,0,0.48)",5);F(ue,"left");G(ue,"top");ue.Ka=0;ue.ta=0;var ve=new ya("floaterFontFace","Arial");window.floaterFontText4=ve;E(ve,34);za(ve,"normal");ve.fill=!0;Ba(ve,3,["#00FCFF","#893DFB","#FF00E4"],.72,-.04);Aa(ve,1);Ca(ve,!0);ve.setStrokeColor("#001637");Ea(ve,4);Ga(ve,"miter");Da(ve,1);Fa(ve,!0);Ha(ve,"rgba(0,35,75,0.49)",6);F(ve,"left");G(ve,"top");ve.Ka=0;ve.ta=0;var we=new ya("floaterNumberFontFace","Arial");
window.floaterFontNumberPositive=we;E(we,30);we.fill=!0;we.setFillColor("White");Aa(we,1);Ca(we,!0);we.setStrokeColor("#00106F");Ea(we,2);Ga(we,"miter");Da(we,1);Fa(we,!1);Ha(we,"rgba(0,4,57,0.51)",4);F(we,"left");G(we,"top");we.Ka=0;we.ta=0;var xe=new ya("floaterNumberFontFace","Arial");window.floaterFontNumberNegative=xe;E(xe,30);za(xe,"normal");xe.fill=!0;xe.setFillColor("#FF1E00");Aa(xe,1);Ca(xe,!0);xe.setStrokeColor("#3F0000");Ea(xe,2);Ga(xe,"miter");Da(xe,1);Fa(xe,!1);
Ha(xe,"rgba(57,0,0,0.49)",4);F(xe,"left");G(xe,"top");xe.Ka=0;xe.ta=0;var ye=new ua("f_themeDefault","fonts/f_themeDefault.woff","fonts/f_themeDefault.ttf","fonts");window.f_themeDefaultLoader=ye;var X=new ya("f_themeDefault","Arial");window.f_themeDefault=X;E(X,12);X.fill=!0;X.setFillColor("Black");Aa(X,1);Ca(X,!1);X.setStrokeColor("White");Ea(X,5);Ga(X,"miter");Da(X,1);Fa(X,!0);F(X,"left");G(X,"top");X.Ka=0;X.ta=0;var ze=new ya("Arial","Arial");window.f_tap_to_play=ze;E(ze,28);za(ze,"bold");
ze.fill=!0;ze.setFillColor("#1b2b34");Aa(ze,1);Ca(ze,!1);ze.setStrokeColor("Black");Ea(ze,28);Ga(ze,"round");Da(ze,.55);Fa(ze,!1);F(ze,"center");G(ze,"middle");ze.Ka=0;ze.ta=0;var Ae=new ya("Arial","Arial");window.f_adblocker=Ae;E(Ae,28);za(Ae,"normal");Ae.fill=!0;Ae.setFillColor("White");Aa(Ae,1);Ca(Ae,!1);Ae.setStrokeColor("Black");Ea(Ae,28);Ga(Ae,"round");Da(Ae,.55);Fa(Ae,!1);F(Ae,"center");G(Ae,"middle");Ae.Ka=0;Ae.ta=0;var Be=new ya("Arial","Arial");window.f_copyright=Be;E(Be,22);za(Be,"bold");
Be.fill=!0;Be.setFillColor("#1b2b34");Aa(Be,1);Ca(Be,!1);Be.setStrokeColor("Black");Ea(Be,28);Ga(Be,"round");Da(Be,.55);Fa(Be,!1);F(Be,"left");G(Be,"middle");Be.Ka=0;Be.ta=0;var Ce=new ya("Arial","Arial");window.f_thankyou=Ce;E(Ce,50);za(Ce,"bold");Ce.fill=!0;Ce.setFillColor("#1b2b34");Aa(Ce,1);Ca(Ce,!1);Ce.setStrokeColor("Black");Ea(Ce,28);Ga(Ce,"round");Da(Ce,.55);Fa(Ce,!1);F(Ce,"center");G(Ce,"middle");Ce.Ka=0;Ce.ta=0;var De=new ya("Arial","Arial");window.f_loading_game=De;E(De,20);za(De,"bold");
De.fill=!0;De.setFillColor("#1b2b34");Aa(De,1);Ca(De,!1);De.setStrokeColor("Black");Ea(De,28);Ga(De,"round");Da(De,.55);Fa(De,!1);F(De,"left");G(De,"middle");De.Ka=0;De.ta=0;var Ee=new ya("Arial","Arial");window.f_interstitial=Ee;E(Ee,20);za(Ee,"bold");Ee.fill=!0;Ee.setFillColor("#1b2b34");Aa(Ee,.38);Ca(Ee,!1);Ee.setStrokeColor("Black");Ea(Ee,28);Ga(Ee,"round");Da(Ee,.55);Fa(Ee,!1);F(Ee,"center");G(Ee,"middle");Ee.Ka=0;Ee.ta=0;
var Fe=new lb("audioSprite","audio/audioSprite.mp3","audio/audioSprite.ogg","audio");window.audioSprite=Fe;var Ge=new eb("a_shuffle_deck",Fe,0,1164,1,10,["game"]);window.a_shuffle_deck=Ge;var He=new eb("a_move_card",Fe,3E3,108,1,10,["game"]);window.a_move_card=He;var Ie=new eb("a_flip_card",Fe,5E3,359,1,10,["game"]);window.a_flip_card=Ie;var Je=new eb("a_place_error",Fe,7E3,241,1,10,["game"]);window.a_place_error=Je;var Ke=new eb("a_card_placed",Fe,9E3,99,1,10,["game"]);window.a_card_placed=Ke;
var Le=new eb("a_foundation_placed",Fe,11E3,755,1,10,["game"]);window.a_foundation_placed=Le;var Me=new eb("a_levelStart",Fe,13E3,1002,1,10,["sfx"]);window.a_levelStart=Me;var Ne=new eb("a_levelComplete",Fe,16E3,1002,1,10,["sfx"]);window.a_levelComplete=Ne;var Oe=new eb("a_mouseDown",Fe,19E3,471,1,10,["sfx"]);window.a_mouseDown=Oe;var Pe=new eb("a_levelend_star_01",Fe,21E3,1161,1,10,["sfx"]);window.a_levelend_star_01=Pe;var Qe=new eb("a_levelend_star_02",Fe,24E3,1070,1,10,["sfx"]);
window.a_levelend_star_02=Qe;var Re=new eb("a_levelend_star_03",Fe,27E3,1039,1,10,["sfx"]);window.a_levelend_star_03=Re;var Se=new eb("a_levelend_fail",Fe,3E4,1572,1,10,["sfx"]);window.a_levelend_fail=Se;var Te=new eb("a_levelend_score_counter",Fe,33E3,54,1,10,["sfx"]);window.a_levelend_score_counter=Te;var Ve=new eb("a_levelend_score_end",Fe,35E3,888,1,10,["sfx"]);window.a_levelend_score_end=Ve;var We=new eb("a_medal",Fe,37E3,1225,1,10,["sfx"]);window.a_medal=We;var Y=Y||{};
Y["nl-nl"]=Y["nl-nl"]||{};Y["nl-nl"].loadingScreenLoading="Laden...";Y["nl-nl"].startScreenPlay="SPELEN";Y["nl-nl"].levelMapScreenTotalScore="Totale score";Y["nl-nl"].levelEndScreenTitle_level="Level <VALUE>";Y["nl-nl"].levelEndScreenTitle_difficulty="Goed Gedaan!";Y["nl-nl"].levelEndScreenTitle_endless="Level <VALUE>";Y["nl-nl"].levelEndScreenTotalScore="Totale score";Y["nl-nl"].levelEndScreenSubTitle_levelFailed="Level niet gehaald";Y["nl-nl"].levelEndScreenTimeLeft="Tijd over";
Y["nl-nl"].levelEndScreenTimeBonus="Tijdbonus";Y["nl-nl"].levelEndScreenHighScore="High score";Y["nl-nl"].optionsStartScreen="Hoofdmenu";Y["nl-nl"].optionsQuit="Stop";Y["nl-nl"].optionsResume="Terug naar spel";Y["nl-nl"].optionsTutorial="Speluitleg";Y["nl-nl"].optionsHighScore="High scores";Y["nl-nl"].optionsMoreGames="Meer Spellen";Y["nl-nl"].optionsDifficulty_easy="Makkelijk";Y["nl-nl"].optionsDifficulty_medium="Gemiddeld";Y["nl-nl"].optionsDifficulty_hard="Moeilijk";
Y["nl-nl"].optionsMusic_on="Aan";Y["nl-nl"].optionsMusic_off="Uit";Y["nl-nl"].optionsSFX_on="Aan";Y["nl-nl"].optionsSFX_off="Uit";Y["nl-nl"]["optionsLang_en-us"]="Engels (US)";Y["nl-nl"]["optionsLang_en-gb"]="Engels (GB)";Y["nl-nl"]["optionsLang_nl-nl"]="Nederlands";Y["nl-nl"].gameEndScreenTitle="Gefeliciteerd!\nJe hebt gewonnen.";Y["nl-nl"].gameEndScreenBtnText="Ga verder";Y["nl-nl"].optionsTitle="Instellingen";Y["nl-nl"].optionsQuitConfirmationText="Pas op!\n\nAls je nu stopt verlies je alle voortgang in dit level. Weet je zeker dat je wilt stoppen?";
Y["nl-nl"].optionsQuitConfirmBtn_No="Nee";Y["nl-nl"].optionsQuitConfirmBtn_Yes="Ja, ik weet het zeker";Y["nl-nl"].levelMapScreenTitle="Kies een level";Y["nl-nl"].optionsRestartConfirmationText="Pas op!\n\nAls je nu herstart verlies je alle voortgang in dit level. Weet je zeker dat je wilt herstarten?";Y["nl-nl"].optionsRestart="Herstart";Y["nl-nl"].optionsSFXBig_on="Geluid aan";Y["nl-nl"].optionsSFXBig_off="Geluid uit";Y["nl-nl"].optionsAbout_title="Over ons";Y["nl-nl"].optionsAbout_text="CoolGames\nwww.coolgames.com\nCopyright \u00a9 2020";
Y["nl-nl"].optionsAbout_backBtn="Terug";Y["nl-nl"].optionsAbout_version="versie:";Y["nl-nl"].optionsAbout="Over ons";Y["nl-nl"].levelEndScreenMedal="VERBETERD!";Y["nl-nl"].startScreenQuestionaire="Wat vind jij?";Y["nl-nl"].levelMapScreenWorld_0="Kies een level";Y["nl-nl"].startScreenByTinglyGames="door: CoolGames";Y["nl-nl"]["optionsLang_de-de"]="Duits";Y["nl-nl"]["optionsLang_tr-tr"]="Turks";Y["nl-nl"].optionsAbout_header="Ontwikkeld door:";Y["nl-nl"].levelEndScreenViewHighscoreBtn="Scores bekijken";
Y["nl-nl"].levelEndScreenSubmitHighscoreBtn="Score verzenden";Y["nl-nl"].challengeStartScreenTitle_challengee_friend="Je bent uitgedaagd door:";Y["nl-nl"].challengeStartTextScore="Punten van <NAME>:";Y["nl-nl"].challengeStartTextTime="Tijd van <NAME>:";Y["nl-nl"].challengeStartScreenToWin="Te winnen aantal Fairplay munten:";Y["nl-nl"].challengeEndScreenWinnings="Je hebt <AMOUNT> Fairplay munten gewonnen!";Y["nl-nl"].challengeEndScreenOutcomeMessage_WON="Je hebt de uitdaging gewonnen!";
Y["nl-nl"].challengeEndScreenOutcomeMessage_LOST="Je hebt de uitdaging verloren.";Y["nl-nl"].challengeEndScreenOutcomeMessage_TIED="Jullie hebben gelijk gespeeld.";Y["nl-nl"].challengeCancelConfirmText="Je staat op het punt de uitdaging te annuleren. Je inzet wordt teruggestort minus de uitdagingskosten. Weet je zeker dat je de uitdaging wilt annuleren? ";Y["nl-nl"].challengeCancelConfirmBtn_yes="Ja";Y["nl-nl"].challengeCancelConfirmBtn_no="Nee";Y["nl-nl"].challengeEndScreensBtn_submit="Verstuur uitdaging";
Y["nl-nl"].challengeEndScreenBtn_cancel="Annuleer uitdaging";Y["nl-nl"].challengeEndScreenName_you="Jij";Y["nl-nl"].challengeEndScreenChallengeSend_error="Er is een fout opgetreden bij het versturen van de uitdaging. Probeer het later nog een keer.";Y["nl-nl"].challengeEndScreenChallengeSend_success="Je uitdaging is verstuurd!";Y["nl-nl"].challengeCancelMessage_error="Er is een fout opgetreden bij het annuleren van de uitdaging. Probeer het later nog een keer.";
Y["nl-nl"].challengeCancelMessage_success="De uitdaging is geannuleerd.";Y["nl-nl"].challengeEndScreenScoreSend_error="Er is een fout opgetreden tijdens de communicatie met de server. Probeer het later nog een keer.";Y["nl-nl"].challengeStartScreenTitle_challengee_stranger="Jouw tegenstander:";Y["nl-nl"].challengeStartScreenTitle_challenger_friend="Jouw tegenstander:";Y["nl-nl"].challengeStartScreenTitle_challenger_stranger="Je zet een uitdaging voor:";
Y["nl-nl"].challengeStartTextTime_challenger="Speel het spel en zet een tijd neer.";Y["nl-nl"].challengeStartTextScore_challenger="Speel het spel en zet een score neer.";Y["nl-nl"].challengeForfeitConfirmText="Je staat op het punt de uitdaging op te geven. Weet je zeker dat je dit wilt doen?";Y["nl-nl"].challengeForfeitConfirmBtn_yes="Ja";Y["nl-nl"].challengeForfeitConfirmBtn_no="Nee";Y["nl-nl"].challengeForfeitMessage_success="Je hebt de uitdaging opgegeven.";
Y["nl-nl"].challengeForfeitMessage_error="Er is een fout opgetreden tijdens het opgeven van de uitdaging. Probeer het later nog een keer.";Y["nl-nl"].optionsChallengeForfeit="Geef op";Y["nl-nl"].optionsChallengeCancel="Stop";Y["nl-nl"].challengeLoadingError_notValid="Sorry, deze uitdaging kan niet meer gespeeld worden.";Y["nl-nl"].challengeLoadingError_notStarted="Kan de server niet bereiken. Probeer het later nog een keer.";Y["nl-nl"].levelEndScreenHighScore_time="Beste tijd:";
Y["nl-nl"].levelEndScreenTotalScore_time="Totale tijd:";Y["nl-nl"]["optionsLang_fr-fr"]="Frans";Y["nl-nl"]["optionsLang_ko-kr"]="Koreaans";Y["nl-nl"]["optionsLang_ar-eg"]="Arabisch";Y["nl-nl"]["optionsLang_es-es"]="Spaans";Y["nl-nl"]["optionsLang_pt-br"]="Braziliaans-Portugees";Y["nl-nl"]["optionsLang_ru-ru"]="Russisch";Y["nl-nl"].optionsExit="Stoppen";Y["nl-nl"].levelEndScreenTotalScore_number="Totale score:";Y["nl-nl"].levelEndScreenHighScore_number="Topscore:";
Y["nl-nl"].challengeEndScreenChallengeSend_submessage="<NAME> heeft 72 uur om de uitdaging aan te nemen of te weigeren. Als <NAME> je uitdaging weigert of niet accepteert binnen 72 uur worden je inzet en uitdagingskosten teruggestort.";Y["nl-nl"].challengeEndScreenChallengeSend_submessage_stranger="Als niemand binnen 72 uur je uitdaging accepteert, worden je inzet en uitdagingskosten teruggestort.";Y["nl-nl"].challengeForfeitMessage_winnings="<NAME> heeft <AMOUNT> Fairplay munten gewonnen!";
Y["nl-nl"].optionsAbout_header_publisher="Published by:";Y["nl-nl"]["optionsLang_jp-jp"]="Japans";Y["nl-nl"]["optionsLang_it-it"]="Italiaans";Y["en-us"]=Y["en-us"]||{};Y["en-us"].loadingScreenLoading="Loading...";Y["en-us"].startScreenPlay="PLAY";Y["en-us"].levelMapScreenTotalScore="Total score";Y["en-us"].levelEndScreenTitle_level="Level <VALUE>";Y["en-us"].levelEndScreenTitle_difficulty="Well done!";Y["en-us"].levelEndScreenTitle_endless="Stage <VALUE>";Y["en-us"].levelEndScreenTotalScore="Total score";
Y["en-us"].levelEndScreenSubTitle_levelFailed="Level failed";Y["en-us"].levelEndScreenTimeLeft="Time remaining";Y["en-us"].levelEndScreenTimeBonus="Time bonus";Y["en-us"].levelEndScreenHighScore="High score";Y["en-us"].optionsStartScreen="Main menu";Y["en-us"].optionsQuit="Quit";Y["en-us"].optionsResume="Resume";Y["en-us"].optionsTutorial="How to play";Y["en-us"].optionsHighScore="High scores";Y["en-us"].optionsMoreGames="More Games";Y["en-us"].optionsDifficulty_easy="Easy";
Y["en-us"].optionsDifficulty_medium="Medium";Y["en-us"].optionsDifficulty_hard="Difficult";Y["en-us"].optionsMusic_on="On";Y["en-us"].optionsMusic_off="Off";Y["en-us"].optionsSFX_on="On";Y["en-us"].optionsSFX_off="Off";Y["en-us"]["optionsLang_en-us"]="English (US)";Y["en-us"]["optionsLang_en-gb"]="English (GB)";Y["en-us"]["optionsLang_nl-nl"]="Dutch";Y["en-us"].gameEndScreenTitle="Congratulations!\nYou have completed the game.";Y["en-us"].gameEndScreenBtnText="Continue";Y["en-us"].optionsTitle="Settings";
Y["en-us"].optionsQuitConfirmationText="Attention!\n\nIf you quit now you will lose all progress made during this level. Are you sure you want to quit?";Y["en-us"].optionsQuitConfirmBtn_No="No";Y["en-us"].optionsQuitConfirmBtn_Yes="Yes, I'm sure";Y["en-us"].levelMapScreenTitle="Select a level";Y["en-us"].optionsRestartConfirmationText="Attention!\n\nIf you restart now you will lose all progress made during this level. Are you sure you want to restart?";Y["en-us"].optionsRestart="Restart";
Y["en-us"].optionsSFXBig_on="Sound on";Y["en-us"].optionsSFXBig_off="Sound off";Y["en-us"].optionsAbout_title="About";Y["en-us"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["en-us"].optionsAbout_backBtn="Back";Y["en-us"].optionsAbout_version="version:";Y["en-us"].optionsAbout="About";Y["en-us"].levelEndScreenMedal="IMPROVED!";Y["en-us"].startScreenQuestionaire="What do you think?";Y["en-us"].levelMapScreenWorld_0="Select a level";Y["en-us"].startScreenByTinglyGames="by: CoolGames";
Y["en-us"]["optionsLang_de-de"]="German";Y["en-us"]["optionsLang_tr-tr"]="Turkish";Y["en-us"].optionsAbout_header="Developed by:";Y["en-us"].levelEndScreenViewHighscoreBtn="View scores";Y["en-us"].levelEndScreenSubmitHighscoreBtn="Submit score";Y["en-us"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["en-us"].challengeStartTextScore="<NAME>'s score:";Y["en-us"].challengeStartTextTime="<NAME>'s time:";Y["en-us"].challengeStartScreenToWin="Amount to win:";
Y["en-us"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["en-us"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["en-us"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["en-us"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["en-us"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["en-us"].challengeCancelConfirmBtn_yes="Yes";Y["en-us"].challengeCancelConfirmBtn_no="No";Y["en-us"].challengeEndScreensBtn_submit="Submit challenge";Y["en-us"].challengeEndScreenBtn_cancel="Cancel challenge";Y["en-us"].challengeEndScreenName_you="You";Y["en-us"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["en-us"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
Y["en-us"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["en-us"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["en-us"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["en-us"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["en-us"].challengeStartScreenTitle_challenger_friend="You are challenging:";
Y["en-us"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["en-us"].challengeStartTextTime_challenger="Play the game and set a time.";Y["en-us"].challengeStartTextScore_challenger="Play the game and set a score.";Y["en-us"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["en-us"].challengeForfeitConfirmBtn_yes="Yes";Y["en-us"].challengeForfeitConfirmBtn_no="No";Y["en-us"].challengeForfeitMessage_success="You have forfeited the challenge.";
Y["en-us"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["en-us"].optionsChallengeForfeit="Forfeit";Y["en-us"].optionsChallengeCancel="Quit";Y["en-us"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["en-us"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["en-us"].levelEndScreenHighScore_time="Best time:";Y["en-us"].levelEndScreenTotalScore_time="Total time:";
Y["en-us"]["optionsLang_fr-fr"]="French";Y["en-us"]["optionsLang_ko-kr"]="Korean";Y["en-us"]["optionsLang_ar-eg"]="Arabic";Y["en-us"]["optionsLang_es-es"]="Spanish";Y["en-us"]["optionsLang_pt-br"]="Brazilian-Portuguese";Y["en-us"]["optionsLang_ru-ru"]="Russian";Y["en-us"].optionsExit="Exit";Y["en-us"].levelEndScreenTotalScore_number="Total score:";Y["en-us"].levelEndScreenHighScore_number="High score:";Y["en-us"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["en-us"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["en-us"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["en-us"].optionsAbout_header_publisher="Published by:";Y["en-us"]["optionsLang_jp-jp"]="Japanese";Y["en-us"]["optionsLang_it-it"]="Italian";Y["en-gb"]=Y["en-gb"]||{};Y["en-gb"].loadingScreenLoading="Loading...";
Y["en-gb"].startScreenPlay="PLAY";Y["en-gb"].levelMapScreenTotalScore="Total score";Y["en-gb"].levelEndScreenTitle_level="Level <VALUE>";Y["en-gb"].levelEndScreenTitle_difficulty="Well done!";Y["en-gb"].levelEndScreenTitle_endless="Stage <VALUE>";Y["en-gb"].levelEndScreenTotalScore="Total score";Y["en-gb"].levelEndScreenSubTitle_levelFailed="Level failed";Y["en-gb"].levelEndScreenTimeLeft="Time remaining";Y["en-gb"].levelEndScreenTimeBonus="Time bonus";Y["en-gb"].levelEndScreenHighScore="High score";
Y["en-gb"].optionsStartScreen="Main menu";Y["en-gb"].optionsQuit="Quit";Y["en-gb"].optionsResume="Resume";Y["en-gb"].optionsTutorial="How to play";Y["en-gb"].optionsHighScore="High scores";Y["en-gb"].optionsMoreGames="More Games";Y["en-gb"].optionsDifficulty_easy="Easy";Y["en-gb"].optionsDifficulty_medium="Medium";Y["en-gb"].optionsDifficulty_hard="Difficult";Y["en-gb"].optionsMusic_on="On";Y["en-gb"].optionsMusic_off="Off";Y["en-gb"].optionsSFX_on="On";Y["en-gb"].optionsSFX_off="Off";
Y["en-gb"]["optionsLang_en-us"]="English (US)";Y["en-gb"]["optionsLang_en-gb"]="English (GB)";Y["en-gb"]["optionsLang_nl-nl"]="Dutch";Y["en-gb"].gameEndScreenTitle="Congratulations!\nYou have completed the game.";Y["en-gb"].gameEndScreenBtnText="Continue";Y["en-gb"].optionsTitle="Settings";Y["en-gb"].optionsQuitConfirmationText="Attention!\n\nIf you quit now you will lose all progress made during this level. Are you sure you want to quit?";Y["en-gb"].optionsQuitConfirmBtn_No="No";
Y["en-gb"].optionsQuitConfirmBtn_Yes="Yes, I'm sure";Y["en-gb"].levelMapScreenTitle="Select a level";Y["en-gb"].optionsRestartConfirmationText="Attention!\n\nIf you restart now you will lose all progress made during this level. Are you sure you want to restart?";Y["en-gb"].optionsRestart="Restart";Y["en-gb"].optionsSFXBig_on="Sound on";Y["en-gb"].optionsSFXBig_off="Sound off";Y["en-gb"].optionsAbout_title="About";Y["en-gb"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";
Y["en-gb"].optionsAbout_backBtn="Back";Y["en-gb"].optionsAbout_version="version:";Y["en-gb"].optionsAbout="About";Y["en-gb"].levelEndScreenMedal="IMPROVED!";Y["en-gb"].startScreenQuestionaire="What do you think?";Y["en-gb"].levelMapScreenWorld_0="Select a level";Y["en-gb"].startScreenByTinglyGames="by: CoolGames";Y["en-gb"]["optionsLang_de-de"]="German";Y["en-gb"]["optionsLang_tr-tr"]="Turkish";Y["en-gb"].optionsAbout_header="Developed by:";Y["en-gb"].levelEndScreenViewHighscoreBtn="View scores";
Y["en-gb"].levelEndScreenSubmitHighscoreBtn="Submit score";Y["en-gb"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["en-gb"].challengeStartTextScore="<NAME>'s score:";Y["en-gb"].challengeStartTextTime="<NAME>'s time:";Y["en-gb"].challengeStartScreenToWin="Amount to win:";Y["en-gb"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["en-gb"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";
Y["en-gb"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["en-gb"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["en-gb"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";Y["en-gb"].challengeCancelConfirmBtn_yes="Yes";Y["en-gb"].challengeCancelConfirmBtn_no="No";Y["en-gb"].challengeEndScreensBtn_submit="Submit challenge";
Y["en-gb"].challengeEndScreenBtn_cancel="Cancel challenge";Y["en-gb"].challengeEndScreenName_you="You";Y["en-gb"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["en-gb"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";Y["en-gb"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["en-gb"].challengeCancelMessage_success="Your challenge has been cancelled.";
Y["en-gb"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["en-gb"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["en-gb"].challengeStartScreenTitle_challenger_friend="You are challenging:";Y["en-gb"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["en-gb"].challengeStartTextTime_challenger="Play the game and set a time.";
Y["en-gb"].challengeStartTextScore_challenger="Play the game and set a score.";Y["en-gb"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you wish to proceed?";Y["en-gb"].challengeForfeitConfirmBtn_yes="Yes";Y["en-gb"].challengeForfeitConfirmBtn_no="No";Y["en-gb"].challengeForfeitMessage_success="You have forfeited the challenge.";Y["en-gb"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
Y["en-gb"].optionsChallengeForfeit="Forfeit";Y["en-gb"].optionsChallengeCancel="Quit";Y["en-gb"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["en-gb"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["en-gb"].levelEndScreenHighScore_time="Best time:";Y["en-gb"].levelEndScreenTotalScore_time="Total time:";Y["en-gb"]["optionsLang_fr-fr"]="French";Y["en-gb"]["optionsLang_ko-kr"]="Korean";Y["en-gb"]["optionsLang_ar-eg"]="Arabic";
Y["en-gb"]["optionsLang_es-es"]="Spanish";Y["en-gb"]["optionsLang_pt-br"]="Brazilian-Portuguese";Y["en-gb"]["optionsLang_ru-ru"]="Russian";Y["en-gb"].optionsExit="Exit";Y["en-gb"].levelEndScreenTotalScore_number="Total score:";Y["en-gb"].levelEndScreenHighScore_number="High score:";Y["en-gb"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["en-gb"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["en-gb"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["en-gb"].optionsAbout_header_publisher="Published by:";Y["en-gb"]["optionsLang_jp-jp"]="Japanese";Y["en-gb"]["optionsLang_it-it"]="Italian";Y["de-de"]=Y["de-de"]||{};Y["de-de"].loadingScreenLoading="Laden ...";
Y["de-de"].startScreenPlay="SPIELEN";Y["de-de"].levelMapScreenTotalScore="Gesamtpunkte";Y["de-de"].levelEndScreenTitle_level="Level <VALUE>";Y["de-de"].levelEndScreenTitle_difficulty="Sehr gut!";Y["de-de"].levelEndScreenTitle_endless="Stufe <VALUE>";Y["de-de"].levelEndScreenTotalScore="Gesamtpunkte";Y["de-de"].levelEndScreenSubTitle_levelFailed="Level nicht geschafft";Y["de-de"].levelEndScreenTimeLeft="Restzeit";Y["de-de"].levelEndScreenTimeBonus="Zeitbonus";Y["de-de"].levelEndScreenHighScore="Highscore";
Y["de-de"].optionsStartScreen="Hauptmen\u00fc";Y["de-de"].optionsQuit="Beenden";Y["de-de"].optionsResume="Weiterspielen";Y["de-de"].optionsTutorial="So wird gespielt";Y["de-de"].optionsHighScore="Highscores";Y["de-de"].optionsMoreGames="Weitere Spiele";Y["de-de"].optionsDifficulty_easy="Einfach";Y["de-de"].optionsDifficulty_medium="Mittel";Y["de-de"].optionsDifficulty_hard="Schwer";Y["de-de"].optionsMusic_on="EIN";Y["de-de"].optionsMusic_off="AUS";Y["de-de"].optionsSFX_on="EIN";
Y["de-de"].optionsSFX_off="AUS";Y["de-de"]["optionsLang_en-us"]="Englisch (US)";Y["de-de"]["optionsLang_en-gb"]="Englisch (GB)";Y["de-de"]["optionsLang_nl-nl"]="Holl\u00e4ndisch";Y["de-de"].gameEndScreenTitle="Gl\u00fcckwunsch!\nDu hast das Spiel abgeschlossen.";Y["de-de"].gameEndScreenBtnText="Weiter";Y["de-de"].optionsTitle="Einstellungen";Y["de-de"].optionsQuitConfirmationText="Achtung!\n\nWenn du jetzt aufh\u00f6rst, verlierst du alle in diesem Level gemachten Fortschritte. Willst du wirklich aufh\u00f6ren?";
Y["de-de"].optionsQuitConfirmBtn_No="NEIN";Y["de-de"].optionsQuitConfirmBtn_Yes="Ja, ich bin mir sicher";Y["de-de"].levelMapScreenTitle="W\u00e4hle ein Level";Y["de-de"].optionsRestartConfirmationText="Achtung!\n\nWenn du jetzt neu startest, verlierst du alle in diesem Level gemachten Fortschritte. Willst du wirklich neu starten?";Y["de-de"].optionsRestart="Neustart";Y["de-de"].optionsSFXBig_on="Sound EIN";Y["de-de"].optionsSFXBig_off="Sound AUS";Y["de-de"].optionsAbout_title="\u00dcber";
Y["de-de"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["de-de"].optionsAbout_backBtn="Zur\u00fcck";Y["de-de"].optionsAbout_version="Version:";Y["de-de"].optionsAbout="\u00dcber";Y["de-de"].levelEndScreenMedal="VERBESSERT!";Y["de-de"].startScreenQuestionaire="Deine Meinung z\u00e4hlt!";Y["de-de"].levelMapScreenWorld_0="W\u00e4hle ein Level";Y["de-de"].startScreenByTinglyGames="von: CoolGames";Y["de-de"]["optionsLang_de-de"]="Deutsch";Y["de-de"]["optionsLang_tr-tr"]="T\u00fcrkisch";
Y["de-de"].optionsAbout_header="Entwickelt von:";Y["de-de"].levelEndScreenViewHighscoreBtn="Punktzahlen ansehen";Y["de-de"].levelEndScreenSubmitHighscoreBtn="Punktzahl senden";Y["de-de"].challengeStartScreenTitle_challengee_friend="Dein Gegner:";Y["de-de"].challengeStartTextScore="Punktzahl von <NAME>:";Y["de-de"].challengeStartTextTime="Zeit von <NAME>:";Y["de-de"].challengeStartScreenToWin="Einsatz:";Y["de-de"].challengeEndScreenWinnings="Du hast <AMOUNT> Fairm\u00fcnzen gewonnen!";
Y["de-de"].challengeEndScreenOutcomeMessage_WON="Du hast die Partie gewonnen!";Y["de-de"].challengeEndScreenOutcomeMessage_LOST="Leider hat Dein Gegner die Partie gewonnen.";Y["de-de"].challengeEndScreenOutcomeMessage_TIED="Gleichstand!";Y["de-de"].challengeCancelConfirmText="Willst Du Deine Wette wirklich zur\u00fcckziehen? Dein Wetteinsatz wird Dir zur\u00fcckgegeben minus die Einsatzgeb\u00fchr.";Y["de-de"].challengeCancelConfirmBtn_yes="Ja";Y["de-de"].challengeCancelConfirmBtn_no="Nein";
Y["de-de"].challengeEndScreensBtn_submit="Herausfordern";Y["de-de"].challengeEndScreenBtn_cancel="Zur\u00fcckziehen";Y["de-de"].challengeEndScreenName_you="Du";Y["de-de"].challengeEndScreenChallengeSend_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";Y["de-de"].challengeEndScreenChallengeSend_success="Herausforderung verschickt!";Y["de-de"].challengeCancelMessage_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";
Y["de-de"].challengeCancelMessage_success="Du hast die Wette erfolgreich zur\u00fcckgezogen.";Y["de-de"].challengeEndScreenScoreSend_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";Y["de-de"].challengeStartScreenTitle_challengee_stranger="Dein Gegner wird:";Y["de-de"].challengeStartScreenTitle_challenger_friend="Du hast den folgenden Spieler herausgefordert:";Y["de-de"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
Y["de-de"].challengeStartTextTime_challenger="Spiel um die niedrigste Zeit!";Y["de-de"].challengeStartTextScore_challenger="Spiel um die hochste Punktzahl!";Y["de-de"].challengeForfeitConfirmText="Willst du Die Partie wirklich aufgeben?";Y["de-de"].challengeForfeitConfirmBtn_yes="Ja";Y["de-de"].challengeForfeitConfirmBtn_no="Nein";Y["de-de"].challengeForfeitMessage_success="You have forfeited the challenge.";Y["de-de"].challengeForfeitMessage_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";
Y["de-de"].optionsChallengeForfeit="Aufgeben";Y["de-de"].optionsChallengeCancel="Zur\u00fcckziehen";Y["de-de"].challengeLoadingError_notValid="Leider ist diese Partie nicht mehr aktuel.";Y["de-de"].challengeLoadingError_notStarted="Leider ist ein Fehler\u00a0aufgetreten. Es konnte keiner Verbindung zum Server hergestellt werden. Versuche es bitte nochmal sp\u00e4ter.";Y["de-de"].levelEndScreenHighScore_time="Bestzeit:";Y["de-de"].levelEndScreenTotalScore_time="Gesamtzeit:";
Y["de-de"]["optionsLang_fr-fr"]="Franz\u00f6sisch";Y["de-de"]["optionsLang_ko-kr"]="Koreanisch";Y["de-de"]["optionsLang_ar-eg"]="Arabisch";Y["de-de"]["optionsLang_es-es"]="Spanisch";Y["de-de"]["optionsLang_pt-br"]="Portugiesisch (Brasilien)";Y["de-de"]["optionsLang_ru-ru"]="Russisch";Y["de-de"].optionsExit="Verlassen";Y["de-de"].levelEndScreenTotalScore_number="Gesamtpunktzahl:";Y["de-de"].levelEndScreenHighScore_number="Highscore:";Y["de-de"].challengeEndScreenChallengeSend_submessage="<NAME> hat 72 Stunden um die Wette anzunehmen oder abzulehnen. Sollte <NAME> nicht reagieren oder ablehnen werden Dir Dein Wetteinsatz und die Geb\u00fchr zur\u00fcckerstattet.";
Y["de-de"].challengeEndScreenChallengeSend_submessage_stranger="Als niemanden Deine Herausforderung innerhalb von 72 Stunden annimmt, werden Dir Deinen Wetteinsatz Einsatzgeb\u00fchr zur\u00fcckerstattet.";Y["de-de"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["de-de"].optionsAbout_header_publisher="Published by:";Y["de-de"]["optionsLang_jp-jp"]="Japanese";Y["de-de"]["optionsLang_it-it"]="Italian";Y["fr-fr"]=Y["fr-fr"]||{};Y["fr-fr"].loadingScreenLoading="Chargement...";
Y["fr-fr"].startScreenPlay="JOUER";Y["fr-fr"].levelMapScreenTotalScore="Score total";Y["fr-fr"].levelEndScreenTitle_level="Niveau <VALUE>";Y["fr-fr"].levelEndScreenTitle_difficulty="Bien jou\u00e9 !";Y["fr-fr"].levelEndScreenTitle_endless="Sc\u00e8ne <VALUE>";Y["fr-fr"].levelEndScreenTotalScore="Score total";Y["fr-fr"].levelEndScreenSubTitle_levelFailed="\u00c9chec du niveau";Y["fr-fr"].levelEndScreenTimeLeft="Temps restant";Y["fr-fr"].levelEndScreenTimeBonus="Bonus de temps";
Y["fr-fr"].levelEndScreenHighScore="Meilleur score";Y["fr-fr"].optionsStartScreen="Menu principal";Y["fr-fr"].optionsQuit="Quitter";Y["fr-fr"].optionsResume="Reprendre";Y["fr-fr"].optionsTutorial="Comment jouer";Y["fr-fr"].optionsHighScore="Meilleurs scores";Y["fr-fr"].optionsMoreGames="Plus de jeux";Y["fr-fr"].optionsDifficulty_easy="Facile";Y["fr-fr"].optionsDifficulty_medium="Moyen";Y["fr-fr"].optionsDifficulty_hard="Difficile";Y["fr-fr"].optionsMusic_on="Avec";Y["fr-fr"].optionsMusic_off="Sans";
Y["fr-fr"].optionsSFX_on="Avec";Y["fr-fr"].optionsSFX_off="Sans";Y["fr-fr"]["optionsLang_en-us"]="Anglais (US)";Y["fr-fr"]["optionsLang_en-gb"]="Anglais (UK)";Y["fr-fr"]["optionsLang_nl-nl"]="N\u00e9erlandais";Y["fr-fr"].gameEndScreenTitle="F\u00e9licitations !\nVous avez termin\u00e9 le jeu.";Y["fr-fr"].gameEndScreenBtnText="Continuer";Y["fr-fr"].optionsTitle="Param\u00e8tres";Y["fr-fr"].optionsQuitConfirmationText="Attention !\n\nEn quittant maintenant, vous perdrez votre progression pour le niveau en cours. Quitter quand m\u00eame ?";
Y["fr-fr"].optionsQuitConfirmBtn_No="Non";Y["fr-fr"].optionsQuitConfirmBtn_Yes="Oui";Y["fr-fr"].levelMapScreenTitle="Choisir un niveau";Y["fr-fr"].optionsRestartConfirmationText="Attention !\n\nEn recommen\u00e7ant maintenant, vous perdrez votre progression pour le niveau en cours. Recommencer quand m\u00eame ?";Y["fr-fr"].optionsRestart="Recommencer";Y["fr-fr"].optionsSFXBig_on="Avec son";Y["fr-fr"].optionsSFXBig_off="Sans son";Y["fr-fr"].optionsAbout_title="\u00c0 propos";
Y["fr-fr"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["fr-fr"].optionsAbout_backBtn="Retour";Y["fr-fr"].optionsAbout_version="Version :";Y["fr-fr"].optionsAbout="\u00c0 propos";Y["fr-fr"].levelEndScreenMedal="RECORD BATTU !";Y["fr-fr"].startScreenQuestionaire="Un avis sur le jeu ?";Y["fr-fr"].levelMapScreenWorld_0="Choisir un niveau";Y["fr-fr"].startScreenByTinglyGames="Un jeu CoolGames";Y["fr-fr"]["optionsLang_de-de"]="Allemand";Y["fr-fr"]["optionsLang_tr-tr"]="Turc";
Y["fr-fr"].optionsAbout_header="D\u00e9velopp\u00e9 par :";Y["fr-fr"].levelEndScreenViewHighscoreBtn="Voir les scores";Y["fr-fr"].levelEndScreenSubmitHighscoreBtn="Publier un score";Y["fr-fr"].challengeStartScreenTitle_challengee_friend="Votre adversaire\u00a0:";Y["fr-fr"].challengeStartTextScore="Son score :";Y["fr-fr"].challengeStartTextTime="Son temps\u00a0:";Y["fr-fr"].challengeStartScreenToWin="\u00c0 gagner\u00a0:";Y["fr-fr"].challengeEndScreenWinnings="Vous avez gagn\u00e9 <AMOUNT> fairpoints.";
Y["fr-fr"].challengeEndScreenOutcomeMessage_WON="Vainqueur\u00a0!";Y["fr-fr"].challengeEndScreenOutcomeMessage_LOST="Zut\u00a0!";Y["fr-fr"].challengeEndScreenOutcomeMessage_TIED="Ex-aequo\u00a0!";Y["fr-fr"].challengeCancelConfirmText="Si vous annulez, on vous remboursera le montant du pari moins les frais de pari. Voulez-vous continuer\u00a0? ";Y["fr-fr"].challengeCancelConfirmBtn_yes="Oui";Y["fr-fr"].challengeCancelConfirmBtn_no="Non";Y["fr-fr"].challengeEndScreensBtn_submit="Lancer le d\u00e9fi";
Y["fr-fr"].challengeEndScreenBtn_cancel="Annuler le d\u00e9fi";Y["fr-fr"].challengeEndScreenName_you="Moi";Y["fr-fr"].challengeEndScreenChallengeSend_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";Y["fr-fr"].challengeEndScreenChallengeSend_success="D\u00e9fi lanc\u00e9.";Y["fr-fr"].challengeCancelMessage_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";Y["fr-fr"].challengeCancelMessage_success="D\u00e9fi annul\u00e9.";
Y["fr-fr"].challengeEndScreenScoreSend_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";Y["fr-fr"].challengeStartScreenTitle_challengee_stranger="Votre adversaire\u00a0:";Y["fr-fr"].challengeStartScreenTitle_challenger_friend="Votre adversaire\u00a0:";Y["fr-fr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["fr-fr"].challengeStartTextTime_challenger="Finissez le plus vite possible !";Y["fr-fr"].challengeStartTextScore_challenger="Essayez d\u2019atteindre le plus haut score !";
Y["fr-fr"].challengeForfeitConfirmText="Voulez-vous vraiment abandonner la partie ?";Y["fr-fr"].challengeForfeitConfirmBtn_yes="Oui";Y["fr-fr"].challengeForfeitConfirmBtn_no="Non";Y["fr-fr"].challengeForfeitMessage_success="Vous avez abandonn\u00e9.";Y["fr-fr"].challengeForfeitMessage_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";Y["fr-fr"].optionsChallengeForfeit="Abandonner";Y["fr-fr"].optionsChallengeCancel="Annuler";Y["fr-fr"].challengeLoadingError_notValid="D\u00e9sol\u00e9, cette partie n'existe plus.";
Y["fr-fr"].challengeLoadingError_notStarted="Une erreur de connexion est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";Y["fr-fr"].levelEndScreenHighScore_time="Meilleur temps :";Y["fr-fr"].levelEndScreenTotalScore_time="Temps total :";Y["fr-fr"]["optionsLang_fr-fr"]="Fran\u00e7ais";Y["fr-fr"]["optionsLang_ko-kr"]="Cor\u00e9en";Y["fr-fr"]["optionsLang_ar-eg"]="Arabe";Y["fr-fr"]["optionsLang_es-es"]="Espagnol";Y["fr-fr"]["optionsLang_pt-br"]="Portugais - Br\u00e9silien";
Y["fr-fr"]["optionsLang_ru-ru"]="Russe";Y["fr-fr"].optionsExit="Quitter";Y["fr-fr"].levelEndScreenTotalScore_number="Score total :";Y["fr-fr"].levelEndScreenHighScore_number="Meilleur score :";Y["fr-fr"].challengeEndScreenChallengeSend_submessage="<NAME> a 72 heures pour accepter votre d\u00e9fi. Si <NAME> refuse ou n\u2019accepte pas dans ce d\u00e9lai vous serez rembours\u00e9 le montant de votre pari et les frais de pari.";Y["fr-fr"].challengeEndScreenChallengeSend_submessage_stranger="Si personne n\u2019accepte votre pari d\u2019ici 72 heures, on vous remboursera le montant du pari y compris les frais.";
Y["fr-fr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["fr-fr"].optionsAbout_header_publisher="Published by:";Y["fr-fr"]["optionsLang_jp-jp"]="Japanese";Y["fr-fr"]["optionsLang_it-it"]="Italian";Y["pt-br"]=Y["pt-br"]||{};Y["pt-br"].loadingScreenLoading="Carregando...";Y["pt-br"].startScreenPlay="JOGAR";Y["pt-br"].levelMapScreenTotalScore="Pontua\u00e7\u00e3o";Y["pt-br"].levelEndScreenTitle_level="N\u00edvel <VALUE>";Y["pt-br"].levelEndScreenTitle_difficulty="Muito bem!";
Y["pt-br"].levelEndScreenTitle_endless="Fase <VALUE>";Y["pt-br"].levelEndScreenTotalScore="Pontua\u00e7\u00e3o";Y["pt-br"].levelEndScreenSubTitle_levelFailed="Tente novamente";Y["pt-br"].levelEndScreenTimeLeft="Tempo restante";Y["pt-br"].levelEndScreenTimeBonus="B\u00f4nus de tempo";Y["pt-br"].levelEndScreenHighScore="Recorde";Y["pt-br"].optionsStartScreen="Menu principal";Y["pt-br"].optionsQuit="Sair";Y["pt-br"].optionsResume="Continuar";Y["pt-br"].optionsTutorial="Como jogar";
Y["pt-br"].optionsHighScore="Recordes";Y["pt-br"].optionsMoreGames="Mais jogos";Y["pt-br"].optionsDifficulty_easy="F\u00e1cil";Y["pt-br"].optionsDifficulty_medium="M\u00e9dio";Y["pt-br"].optionsDifficulty_hard="Dif\u00edcil";Y["pt-br"].optionsMusic_on="Sim";Y["pt-br"].optionsMusic_off="N\u00e3o";Y["pt-br"].optionsSFX_on="Sim";Y["pt-br"].optionsSFX_off="N\u00e3o";Y["pt-br"]["optionsLang_en-us"]="Ingl\u00eas (EUA)";Y["pt-br"]["optionsLang_en-gb"]="Ingl\u00eas (GB)";Y["pt-br"]["optionsLang_nl-nl"]="Holand\u00eas";
Y["pt-br"].gameEndScreenTitle="Parab\u00e9ns!\nVoc\u00ea concluiu o jogo.";Y["pt-br"].gameEndScreenBtnText="Continuar";Y["pt-br"].optionsTitle="Configura\u00e7\u00f5es";Y["pt-br"].optionsQuitConfirmationText="Aten\u00e7\u00e3o!\n\nSe voc\u00ea sair agora, perder\u00e1 todo progresso realizado neste n\u00edvel. Deseja mesmo sair?";Y["pt-br"].optionsQuitConfirmBtn_No="N\u00e3o";Y["pt-br"].optionsQuitConfirmBtn_Yes="Sim, tenho certeza.";Y["pt-br"].levelMapScreenTitle="Selecione um n\u00edvel";
Y["pt-br"].optionsRestartConfirmationText="Aten\u00e7\u00e3o!\n\nSe voc\u00ea reiniciar agora, perder\u00e1 todo progresso realizado neste n\u00edvel. Deseja mesmo reiniciar?";Y["pt-br"].optionsRestart="Reiniciar";Y["pt-br"].optionsSFXBig_on="Com som";Y["pt-br"].optionsSFXBig_off="Sem som";Y["pt-br"].optionsAbout_title="Sobre";Y["pt-br"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["pt-br"].optionsAbout_backBtn="Voltar";Y["pt-br"].optionsAbout_version="vers\u00e3o:";
Y["pt-br"].optionsAbout="Sobre";Y["pt-br"].levelEndScreenMedal="MELHOROU!";Y["pt-br"].startScreenQuestionaire="O que voc\u00ea achou?";Y["pt-br"].levelMapScreenWorld_0="Selecione um n\u00edvel";Y["pt-br"].startScreenByTinglyGames="da: CoolGames";Y["pt-br"]["optionsLang_de-de"]="Alem\u00e3o";Y["pt-br"]["optionsLang_tr-tr"]="Turco";Y["pt-br"].optionsAbout_header="Desenvolvido por:";Y["pt-br"].levelEndScreenViewHighscoreBtn="Ver pontua\u00e7\u00f5es";Y["pt-br"].levelEndScreenSubmitHighscoreBtn="Enviar recorde";
Y["pt-br"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["pt-br"].challengeStartTextScore="<NAME>'s score:";Y["pt-br"].challengeStartTextTime="<NAME>'s time:";Y["pt-br"].challengeStartScreenToWin="Amount to win:";Y["pt-br"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["pt-br"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["pt-br"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";
Y["pt-br"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["pt-br"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";Y["pt-br"].challengeCancelConfirmBtn_yes="Yes";Y["pt-br"].challengeCancelConfirmBtn_no="No";Y["pt-br"].challengeEndScreensBtn_submit="Submit challenge";Y["pt-br"].challengeEndScreenBtn_cancel="Cancel challenge";Y["pt-br"].challengeEndScreenName_you="You";
Y["pt-br"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["pt-br"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";Y["pt-br"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["pt-br"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["pt-br"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";
Y["pt-br"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["pt-br"].challengeStartScreenTitle_challenger_friend="You are challenging:";Y["pt-br"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["pt-br"].challengeStartTextTime_challenger="Play the game and set a time.";Y["pt-br"].challengeStartTextScore_challenger="Play the game and set a score.";Y["pt-br"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";
Y["pt-br"].challengeForfeitConfirmBtn_yes="Yes";Y["pt-br"].challengeForfeitConfirmBtn_no="No";Y["pt-br"].challengeForfeitMessage_success="You have forfeited the challenge.";Y["pt-br"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["pt-br"].optionsChallengeForfeit="Desistir";Y["pt-br"].optionsChallengeCancel="Sair do Jogo";Y["pt-br"].challengeLoadingError_notValid="Desculpe, este desafio n\u00e3o \u00e9 mais v\u00e1lido.";
Y["pt-br"].challengeLoadingError_notStarted="Imposs\u00edvel conectar ao servidor. Por favor, tente novamente mais tarde.";Y["pt-br"].levelEndScreenHighScore_time="Tempo recorde:";Y["pt-br"].levelEndScreenTotalScore_time="Tempo total:";Y["pt-br"]["optionsLang_fr-fr"]="Franc\u00eas";Y["pt-br"]["optionsLang_ko-kr"]="Coreano";Y["pt-br"]["optionsLang_ar-eg"]="\u00c1rabe";Y["pt-br"]["optionsLang_es-es"]="Espanhol";Y["pt-br"]["optionsLang_pt-br"]="Portugu\u00eas do Brasil";
Y["pt-br"]["optionsLang_ru-ru"]="Russo";Y["pt-br"].optionsExit="Sa\u00edda";Y["pt-br"].levelEndScreenTotalScore_number="Pontua\u00e7\u00e3o total:";Y["pt-br"].levelEndScreenHighScore_number="Pontua\u00e7\u00e3o m\u00e1xima:";Y["pt-br"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["pt-br"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["pt-br"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["pt-br"].optionsAbout_header_publisher="Published by:";Y["pt-br"]["optionsLang_jp-jp"]="Japanese";Y["pt-br"]["optionsLang_it-it"]="Italian";Y["es-es"]=Y["es-es"]||{};Y["es-es"].loadingScreenLoading="Cargando...";
Y["es-es"].startScreenPlay="JUGAR";Y["es-es"].levelMapScreenTotalScore="Punt. total";Y["es-es"].levelEndScreenTitle_level="Nivel <VALUE>";Y["es-es"].levelEndScreenTitle_difficulty="\u00a1Muy bien!";Y["es-es"].levelEndScreenTitle_endless="Fase <VALUE>";Y["es-es"].levelEndScreenTotalScore="Punt. total";Y["es-es"].levelEndScreenSubTitle_levelFailed="Nivel fallido";Y["es-es"].levelEndScreenTimeLeft="Tiempo restante";Y["es-es"].levelEndScreenTimeBonus="Bonif. tiempo";
Y["es-es"].levelEndScreenHighScore="R\u00e9cord";Y["es-es"].optionsStartScreen="Men\u00fa principal";Y["es-es"].optionsQuit="Salir";Y["es-es"].optionsResume="Seguir";Y["es-es"].optionsTutorial="C\u00f3mo jugar";Y["es-es"].optionsHighScore="R\u00e9cords";Y["es-es"].optionsMoreGames="M\u00e1s juegos";Y["es-es"].optionsDifficulty_easy="F\u00e1cil";Y["es-es"].optionsDifficulty_medium="Normal";Y["es-es"].optionsDifficulty_hard="Dif\u00edcil";Y["es-es"].optionsMusic_on="S\u00ed";
Y["es-es"].optionsMusic_off="No";Y["es-es"].optionsSFX_on="S\u00ed";Y["es-es"].optionsSFX_off="No";Y["es-es"]["optionsLang_en-us"]="Ingl\u00e9s (EE.UU.)";Y["es-es"]["optionsLang_en-gb"]="Ingl\u00e9s (GB)";Y["es-es"]["optionsLang_nl-nl"]="Neerland\u00e9s";Y["es-es"].gameEndScreenTitle="\u00a1Enhorabuena!\nHas terminado el juego.";Y["es-es"].gameEndScreenBtnText="Continuar";Y["es-es"].optionsTitle="Ajustes";Y["es-es"].optionsQuitConfirmationText="\u00a1Aviso!\n\nSi sales ahora, perder\u00e1s el progreso que hayas realizado en el nivel. \u00bfSeguro que quieres salir?";
Y["es-es"].optionsQuitConfirmBtn_No="No";Y["es-es"].optionsQuitConfirmBtn_Yes="S\u00ed, seguro";Y["es-es"].levelMapScreenTitle="Elige un nivel";Y["es-es"].optionsRestartConfirmationText="\u00a1Aviso!\n\nSi reinicias ahora, perder\u00e1s el progreso que hayas realizado en el nivel. \u00bfSeguro que quieres reiniciar?";Y["es-es"].optionsRestart="Reiniciar";Y["es-es"].optionsSFXBig_on="Sonido s\u00ed";Y["es-es"].optionsSFXBig_off="Sonido no";Y["es-es"].optionsAbout_title="Acerca de";
Y["es-es"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["es-es"].optionsAbout_backBtn="Atr\u00e1s";Y["es-es"].optionsAbout_version="versi\u00f3n:";Y["es-es"].optionsAbout="Acerca de";Y["es-es"].levelEndScreenMedal="\u00a1SUPERADO!";Y["es-es"].startScreenQuestionaire="\u00bfQu\u00e9 te parece?";Y["es-es"].levelMapScreenWorld_0="Elige un nivel";Y["es-es"].startScreenByTinglyGames="de: CoolGames";Y["es-es"]["optionsLang_de-de"]="Alem\u00e1n";Y["es-es"]["optionsLang_tr-tr"]="Turco";
Y["es-es"].optionsAbout_header="Desarrollado por:";Y["es-es"].levelEndScreenViewHighscoreBtn="Ver puntuaciones";Y["es-es"].levelEndScreenSubmitHighscoreBtn="Enviar puntuaci\u00f3n";Y["es-es"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["es-es"].challengeStartTextScore="<NAME>'s score:";Y["es-es"].challengeStartTextTime="<NAME>'s time:";Y["es-es"].challengeStartScreenToWin="Amount to win:";Y["es-es"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";
Y["es-es"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["es-es"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["es-es"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["es-es"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";Y["es-es"].challengeCancelConfirmBtn_yes="Yes";Y["es-es"].challengeCancelConfirmBtn_no="No";
Y["es-es"].challengeEndScreensBtn_submit="Submit challenge";Y["es-es"].challengeEndScreenBtn_cancel="Cancel challenge";Y["es-es"].challengeEndScreenName_you="You";Y["es-es"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["es-es"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";Y["es-es"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";
Y["es-es"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["es-es"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["es-es"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["es-es"].challengeStartScreenTitle_challenger_friend="You are challenging:";Y["es-es"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
Y["es-es"].challengeStartTextTime_challenger="Play the game and set a time.";Y["es-es"].challengeStartTextScore_challenger="Play the game and set a score.";Y["es-es"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["es-es"].challengeForfeitConfirmBtn_yes="Yes";Y["es-es"].challengeForfeitConfirmBtn_no="No";Y["es-es"].challengeForfeitMessage_success="You have forfeited the challenge.";Y["es-es"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
Y["es-es"].optionsChallengeForfeit="Rendirse";Y["es-es"].optionsChallengeCancel="Abandonar";Y["es-es"].challengeLoadingError_notValid="Lo sentimos, este reto ya no es v\u00e1lido.";Y["es-es"].challengeLoadingError_notStarted="Imposible conectar con el servidor. Int\u00e9ntalo m\u00e1s tarde.";Y["es-es"].levelEndScreenHighScore_time="Mejor tiempo:";Y["es-es"].levelEndScreenTotalScore_time="Tiempo total:";Y["es-es"]["optionsLang_fr-fr"]="Franc\u00e9s";Y["es-es"]["optionsLang_ko-kr"]="Coreano";
Y["es-es"]["optionsLang_ar-eg"]="\u00c1rabe";Y["es-es"]["optionsLang_es-es"]="Espa\u00f1ol";Y["es-es"]["optionsLang_pt-br"]="Portugu\u00e9s brasile\u00f1o";Y["es-es"]["optionsLang_ru-ru"]="Ruso";Y["es-es"].optionsExit="Salir";Y["es-es"].levelEndScreenTotalScore_number="Puntos totales:";Y["es-es"].levelEndScreenHighScore_number="Mejor puntuaci\u00f3n:";Y["es-es"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["es-es"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["es-es"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["es-es"].optionsAbout_header_publisher="Published by:";Y["es-es"]["optionsLang_jp-jp"]="Japanese";Y["es-es"]["optionsLang_it-it"]="Italian";Y["tr-tr"]=Y["tr-tr"]||{};Y["tr-tr"].loadingScreenLoading="Y\u00fckleniyor...";
Y["tr-tr"].startScreenPlay="OYNA";Y["tr-tr"].levelMapScreenTotalScore="Toplam skor";Y["tr-tr"].levelEndScreenTitle_level="Seviye <VALUE>";Y["tr-tr"].levelEndScreenTitle_difficulty="Bravo!";Y["tr-tr"].levelEndScreenTitle_endless="Seviye <VALUE>";Y["tr-tr"].levelEndScreenTotalScore="Toplam skor";Y["tr-tr"].levelEndScreenSubTitle_levelFailed="Seviye ba\u015far\u0131s\u0131z";Y["tr-tr"].levelEndScreenTimeLeft="Kalan S\u00fcre";Y["tr-tr"].levelEndScreenTimeBonus="S\u00fcre Bonusu";
Y["tr-tr"].levelEndScreenHighScore="Y\u00fcksek skor";Y["tr-tr"].optionsStartScreen="Ana men\u00fc";Y["tr-tr"].optionsQuit="\u00c7\u0131k";Y["tr-tr"].optionsResume="Devam et";Y["tr-tr"].optionsTutorial="Nas\u0131l oynan\u0131r";Y["tr-tr"].optionsHighScore="Y\u00fcksek skorlar";Y["tr-tr"].optionsMoreGames="Daha Fazla Oyun";Y["tr-tr"].optionsDifficulty_easy="Kolay";Y["tr-tr"].optionsDifficulty_medium="Orta";Y["tr-tr"].optionsDifficulty_hard="Zorluk";Y["tr-tr"].optionsMusic_on="A\u00e7\u0131k";
Y["tr-tr"].optionsMusic_off="Kapal\u0131";Y["tr-tr"].optionsSFX_on="A\u00e7\u0131k";Y["tr-tr"].optionsSFX_off="Kapal\u0131";Y["tr-tr"]["optionsLang_en-us"]="\u0130ngilizce (US)";Y["tr-tr"]["optionsLang_en-gb"]="\u0130ngilizce (GB)";Y["tr-tr"]["optionsLang_nl-nl"]="Hollandaca";Y["tr-tr"].gameEndScreenTitle="Tebrikler!\nOyunu tamamlad\u0131n.";Y["tr-tr"].gameEndScreenBtnText="Devam";Y["tr-tr"].optionsTitle="Ayarlar";Y["tr-tr"].optionsQuitConfirmationText="Dikkat!\n\u015eimdi \u00e7\u0131karsan bu seviyede yap\u0131lan t\u00fcm ilerleme kaybedilecek. \u00c7\u0131kmak istedi\u011finizden emin misiniz?";
Y["tr-tr"].optionsQuitConfirmBtn_No="Hay\u0131r";Y["tr-tr"].optionsQuitConfirmBtn_Yes="Evet, eminim";Y["tr-tr"].levelMapScreenTitle="Bir seviye se\u00e7";Y["tr-tr"].optionsRestartConfirmationText="Dikkat!\n\u015eimdi tekrar ba\u015flarsan bu seviyede yap\u0131lan t\u00fcm ilerleme kaybedilecek. Ba\u015ftan ba\u015flamak istedi\u011finden emin misin?";Y["tr-tr"].optionsRestart="Tekrar ba\u015flat";Y["tr-tr"].optionsSFXBig_on="Ses a\u00e7\u0131k";Y["tr-tr"].optionsSFXBig_off="Ses kapal\u0131";
Y["tr-tr"].optionsAbout_title="Hakk\u0131nda";Y["tr-tr"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["tr-tr"].optionsAbout_backBtn="Geri";Y["tr-tr"].optionsAbout_version="s\u00fcr\u00fcm:";Y["tr-tr"].optionsAbout="Hakk\u0131nda";Y["tr-tr"].levelEndScreenMedal="\u0130Y\u0130LE\u015eT\u0130!";Y["tr-tr"].startScreenQuestionaire="Ne dersin?";Y["tr-tr"].levelMapScreenWorld_0="Bir seviye se\u00e7";Y["tr-tr"].startScreenByTinglyGames="taraf\u0131ndan: CoolGames";
Y["tr-tr"]["optionsLang_de-de"]="Almanca";Y["tr-tr"]["optionsLang_tr-tr"]="T\u00fcrk\u00e7e";Y["tr-tr"].optionsAbout_header="Haz\u0131rlayan:";Y["tr-tr"].levelEndScreenViewHighscoreBtn="Puanlar\u0131 g\u00f6ster:";Y["tr-tr"].levelEndScreenSubmitHighscoreBtn="Puan g\u00f6nder";Y["tr-tr"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["tr-tr"].challengeStartTextScore="<NAME>'s score:";Y["tr-tr"].challengeStartTextTime="<NAME>'s time:";
Y["tr-tr"].challengeStartScreenToWin="Amount to win:";Y["tr-tr"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["tr-tr"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["tr-tr"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["tr-tr"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["tr-tr"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["tr-tr"].challengeCancelConfirmBtn_yes="Yes";Y["tr-tr"].challengeCancelConfirmBtn_no="No";Y["tr-tr"].challengeEndScreensBtn_submit="Submit challenge";Y["tr-tr"].challengeEndScreenBtn_cancel="Cancel challenge";Y["tr-tr"].challengeEndScreenName_you="You";Y["tr-tr"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["tr-tr"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
Y["tr-tr"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["tr-tr"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["tr-tr"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["tr-tr"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["tr-tr"].challengeStartScreenTitle_challenger_friend="You are challenging:";
Y["tr-tr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["tr-tr"].challengeStartTextTime_challenger="Play the game and set a time.";Y["tr-tr"].challengeStartTextScore_challenger="Play the game and set a score.";Y["tr-tr"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["tr-tr"].challengeForfeitConfirmBtn_yes="Yes";Y["tr-tr"].challengeForfeitConfirmBtn_no="No";Y["tr-tr"].challengeForfeitMessage_success="You have forfeited the challenge.";
Y["tr-tr"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["tr-tr"].optionsChallengeForfeit="Vazge\u00e7";Y["tr-tr"].optionsChallengeCancel="\u00c7\u0131k\u0131\u015f";Y["tr-tr"].challengeLoadingError_notValid="\u00dczg\u00fcn\u00fcz, bu zorluk art\u0131k ge\u00e7erli de\u011fil.";Y["tr-tr"].challengeLoadingError_notStarted="Sunucuya ba\u011flan\u0131lam\u0131yor. L\u00fctfen daha sonra tekrar deneyin.";
Y["tr-tr"].levelEndScreenHighScore_time="En \u0130yi Zaman:";Y["tr-tr"].levelEndScreenTotalScore_time="Toplam Zaman:";Y["tr-tr"]["optionsLang_fr-fr"]="Frans\u0131zca";Y["tr-tr"]["optionsLang_ko-kr"]="Korece";Y["tr-tr"]["optionsLang_ar-eg"]="Arap\u00e7a";Y["tr-tr"]["optionsLang_es-es"]="\u0130spanyolca";Y["tr-tr"]["optionsLang_pt-br"]="Brezilya Portekizcesi";Y["tr-tr"]["optionsLang_ru-ru"]="Rus\u00e7a";Y["tr-tr"].optionsExit="\u00c7\u0131k\u0131\u015f";Y["tr-tr"].levelEndScreenTotalScore_number="Toplam Puan:";
Y["tr-tr"].levelEndScreenHighScore_number="Y\u00fcksek Puan:";Y["tr-tr"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";Y["tr-tr"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";
Y["tr-tr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["tr-tr"].optionsAbout_header_publisher="Published by:";Y["tr-tr"]["optionsLang_jp-jp"]="Japanese";Y["tr-tr"]["optionsLang_it-it"]="Italian";Y["ru-ru"]=Y["ru-ru"]||{};Y["ru-ru"].loadingScreenLoading="\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...";Y["ru-ru"].startScreenPlay="\u0418\u0413\u0420\u0410\u0422\u042c";Y["ru-ru"].levelMapScreenTotalScore="\u041e\u0431\u0449\u0438\u0439 \u0441\u0447\u0435\u0442";
Y["ru-ru"].levelEndScreenTitle_level="\u0423\u0440\u043e\u0432\u0435\u043d\u044c <VALUE>";Y["ru-ru"].levelEndScreenTitle_difficulty="\u0425\u043e\u0440\u043e\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442!";Y["ru-ru"].levelEndScreenTitle_endless="\u042d\u0442\u0430\u043f <VALUE>";Y["ru-ru"].levelEndScreenTotalScore="\u041e\u0431\u0449\u0438\u0439 \u0441\u0447\u0435\u0442";Y["ru-ru"].levelEndScreenSubTitle_levelFailed="\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u043f\u0440\u043e\u0439\u0434\u0435\u043d";
Y["ru-ru"].levelEndScreenTimeLeft="\u041e\u0441\u0442\u0430\u0432\u0448\u0435\u0435\u0441\u044f \u0432\u0440\u0435\u043c\u044f";Y["ru-ru"].levelEndScreenTimeBonus="\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f";Y["ru-ru"].levelEndScreenHighScore="\u0420\u0435\u043a\u043e\u0440\u0434";Y["ru-ru"].optionsStartScreen="\u0413\u043b\u0430\u0432\u043d\u043e\u0435 \u043c\u0435\u043d\u044e";Y["ru-ru"].optionsQuit="\u0412\u044b\u0439\u0442\u0438";
Y["ru-ru"].optionsResume="\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c";Y["ru-ru"].optionsTutorial="\u041a\u0430\u043a \u0438\u0433\u0440\u0430\u0442\u044c";Y["ru-ru"].optionsHighScore="\u0420\u0435\u043a\u043e\u0440\u0434\u044b";Y["ru-ru"].optionsMoreGames="\u0411\u043e\u043b\u044c\u0448\u0435 \u0438\u0433\u0440";Y["ru-ru"].optionsDifficulty_easy="\u041b\u0435\u0433\u043a\u0438\u0439";Y["ru-ru"].optionsDifficulty_medium="\u0421\u0440\u0435\u0434\u043d\u0438\u0439";
Y["ru-ru"].optionsDifficulty_hard="\u0421\u043b\u043e\u0436\u043d\u044b\u0439";Y["ru-ru"].optionsMusic_on="\u0412\u043a\u043b.";Y["ru-ru"].optionsMusic_off="\u0412\u044b\u043a\u043b.";Y["ru-ru"].optionsSFX_on="\u0412\u043a\u043b.";Y["ru-ru"].optionsSFX_off="\u0412\u044b\u043a\u043b.";Y["ru-ru"]["optionsLang_en-us"]="\u0410\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439 (\u0421\u0428\u0410)";Y["ru-ru"]["optionsLang_en-gb"]="\u0410\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439 (\u0412\u0411)";
Y["ru-ru"]["optionsLang_nl-nl"]="\u041d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u0441\u043a\u0438\u0439";Y["ru-ru"].gameEndScreenTitle="\u041f\u043e\u0437\u0434\u0440\u0430\u0432\u043b\u044f\u0435\u043c!\n\u0412\u044b \u043f\u0440\u043e\u0448\u043b\u0438 \u0438\u0433\u0440\u0443.";Y["ru-ru"].gameEndScreenBtnText="\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c";Y["ru-ru"].optionsTitle="\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438";
Y["ru-ru"].optionsQuitConfirmationText="\u0412\u043d\u0438\u043c\u0430\u043d\u0438\u0435!\n\n\u0415\u0441\u043b\u0438 \u0432\u044b \u0432\u044b\u0439\u0434\u0435\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441, \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043d. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0432\u044b\u0439\u0442\u0438?";
Y["ru-ru"].optionsQuitConfirmBtn_No="\u041d\u0435\u0442";Y["ru-ru"].optionsQuitConfirmBtn_Yes="\u0414\u0430, \u0432\u044b\u0439\u0442\u0438";Y["ru-ru"].levelMapScreenTitle="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043e\u0432\u0435\u043d\u044c";Y["ru-ru"].optionsRestartConfirmationText="\u0412\u043d\u0438\u043c\u0430\u043d\u0438\u0435!\n\n\u0415\u0441\u043b\u0438 \u0432\u044b \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0430\u0447\u043d\u0435\u0442\u0435 \u0438\u0433\u0440\u0443 \u0437\u0430\u043d\u043e\u0432\u043e, \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043d. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e?";
Y["ru-ru"].optionsRestart="\u0417\u0430\u043d\u043e\u0432\u043e";Y["ru-ru"].optionsSFXBig_on="\u0417\u0432\u0443\u043a \u0432\u043a\u043b.";Y["ru-ru"].optionsSFXBig_off="\u0417\u0432\u0443\u043a \u0432\u044b\u043a\u043b.";Y["ru-ru"].optionsAbout_title="\u041e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0435";Y["ru-ru"].optionsAbout_text="\u00a9 CoolGames\nwww.coolgames.com\u00820";Y["ru-ru"].optionsAbout_backBtn="\u041d\u0430\u0437\u0430\u0434";Y["ru-ru"].optionsAbout_version="\u0412\u0435\u0440\u0441\u0438\u044f:";
Y["ru-ru"].optionsAbout="\u041e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0435";Y["ru-ru"].levelEndScreenMedal="\u041d\u041e\u0412\u042b\u0419 \u0420\u0415\u041a\u041e\u0420\u0414!";Y["ru-ru"].startScreenQuestionaire="\u041a\u0430\u043a \u0432\u0430\u043c \u0438\u0433\u0440\u0430?";Y["ru-ru"].levelMapScreenWorld_0="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043e\u0432\u0435\u043d\u044c";Y["ru-ru"].startScreenByTinglyGames="\u0420\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0438: CoolGames";
Y["ru-ru"]["optionsLang_de-de"]="\u041d\u0435\u043c\u0435\u0446\u043a\u0438\u0439";Y["ru-ru"]["optionsLang_tr-tr"]="\u0422\u0443\u0440\u0435\u0446\u043a\u0438\u0439";Y["ru-ru"].optionsAbout_header="Developed by:";Y["ru-ru"].levelEndScreenViewHighscoreBtn="View scores";Y["ru-ru"].levelEndScreenSubmitHighscoreBtn="Submit score";Y["ru-ru"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["ru-ru"].challengeStartTextScore="<NAME>'s score:";
Y["ru-ru"].challengeStartTextTime="<NAME>'s time:";Y["ru-ru"].challengeStartScreenToWin="Amount to win:";Y["ru-ru"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["ru-ru"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["ru-ru"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["ru-ru"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["ru-ru"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["ru-ru"].challengeCancelConfirmBtn_yes="Yes";Y["ru-ru"].challengeCancelConfirmBtn_no="No";Y["ru-ru"].challengeEndScreensBtn_submit="Submit challenge";Y["ru-ru"].challengeEndScreenBtn_cancel="Cancel challenge";Y["ru-ru"].challengeEndScreenName_you="You";Y["ru-ru"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["ru-ru"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
Y["ru-ru"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["ru-ru"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["ru-ru"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["ru-ru"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["ru-ru"].challengeStartScreenTitle_challenger_friend="You are challenging:";
Y["ru-ru"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["ru-ru"].challengeStartTextTime_challenger="Play the game and set a time.";Y["ru-ru"].challengeStartTextScore_challenger="Play the game and set a score.";Y["ru-ru"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["ru-ru"].challengeForfeitConfirmBtn_yes="Yes";Y["ru-ru"].challengeForfeitConfirmBtn_no="No";Y["ru-ru"].challengeForfeitMessage_success="You have forfeited the challenge.";
Y["ru-ru"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["ru-ru"].optionsChallengeForfeit="Forfeit";Y["ru-ru"].optionsChallengeCancel="Quit";Y["ru-ru"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["ru-ru"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["ru-ru"].levelEndScreenHighScore_time="Best time:";Y["ru-ru"].levelEndScreenTotalScore_time="Total time:";
Y["ru-ru"]["optionsLang_fr-fr"]="\u0424\u0440\u0430\u043d\u0446\u0443\u0437\u0441\u043a\u0438\u0439";Y["ru-ru"]["optionsLang_ko-kr"]="\u041a\u043e\u0440\u0435\u0439\u0441\u043a\u0438\u0439";Y["ru-ru"]["optionsLang_ar-eg"]="\u0410\u0440\u0430\u0431\u0441\u043a\u0438\u0439";Y["ru-ru"]["optionsLang_es-es"]="\u0418\u0441\u043f\u0430\u043d\u0441\u043a\u0438\u0439";Y["ru-ru"]["optionsLang_pt-br"]="\u0411\u0440\u0430\u0437\u0438\u043b\u044c\u0441\u043a\u0438\u0439 \u043f\u043e\u0440\u0442\u0443\u0433\u0430\u043b\u044c\u0441\u043a\u0438\u0439";
Y["ru-ru"]["optionsLang_ru-ru"]="\u0420\u0443\u0441\u0441\u043a\u0438\u0439";Y["ru-ru"].optionsExit="Exit";Y["ru-ru"].levelEndScreenTotalScore_number="Total score:";Y["ru-ru"].levelEndScreenHighScore_number="High score:";Y["ru-ru"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["ru-ru"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["ru-ru"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["ru-ru"].optionsAbout_header_publisher="Published by:";Y["ru-ru"]["optionsLang_jp-jp"]="Japanese";Y["ru-ru"]["optionsLang_it-it"]="Italian";Y["ar-eg"]=Y["ar-eg"]||{};Y["ar-eg"].loadingScreenLoading="\u064a\u062a\u0645 \u0627\u0644\u0622\u0646 \u0627\u0644\u062a\u062d\u0645\u064a\u0644...";
Y["ar-eg"].startScreenPlay="\u062a\u0634\u063a\u064a\u0644";Y["ar-eg"].levelMapScreenTotalScore="\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629";Y["ar-eg"].levelEndScreenTitle_level="\u0627\u0644\u0645\u0633\u062a\u0648\u0649 <VALUE>";Y["ar-eg"].levelEndScreenTitle_difficulty="\u0623\u062d\u0633\u0646\u062a!";Y["ar-eg"].levelEndScreenTitle_endless="\u0627\u0644\u0645\u0631\u062d\u0644\u0629 <VALUE>";Y["ar-eg"].levelEndScreenTotalScore="\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629";
Y["ar-eg"].levelEndScreenSubTitle_levelFailed="\u0644\u0642\u062f \u0641\u0634\u0644\u062a \u0641\u064a \u0627\u062c\u062a\u064a\u0627\u0632 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649";Y["ar-eg"].levelEndScreenTimeLeft="\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u062a\u0628\u0642\u064a";Y["ar-eg"].levelEndScreenTimeBonus="\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0648\u0642\u062a";Y["ar-eg"].levelEndScreenHighScore="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";
Y["ar-eg"].optionsStartScreen="\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629";Y["ar-eg"].optionsQuit="\u0627\u0644\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629";Y["ar-eg"].optionsResume="\u0627\u0633\u062a\u0626\u0646\u0627\u0641";Y["ar-eg"].optionsTutorial="\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0644\u0639\u0628";Y["ar-eg"].optionsHighScore="\u0623\u0639\u0644\u0649 \u0627\u0644\u0646\u062a\u0627\u0626\u062c";
Y["ar-eg"].optionsMoreGames="\u0627\u0644\u0645\u0632\u064a\u062f \u0645\u0646 \u0627\u0644\u0623\u0644\u0639\u0627\u0628";Y["ar-eg"].optionsDifficulty_easy="\u0633\u0647\u0644";Y["ar-eg"].optionsDifficulty_medium="\u0645\u062a\u0648\u0633\u0637";Y["ar-eg"].optionsDifficulty_hard="\u0635\u0639\u0628";Y["ar-eg"].optionsMusic_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649";Y["ar-eg"].optionsMusic_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649";
Y["ar-eg"].optionsSFX_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0624\u062b\u0631\u0627\u062a \u0627\u0644\u0635\u0648\u062a\u064a\u0629";Y["ar-eg"].optionsSFX_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0645\u0624\u062b\u0631\u0627\u062a \u0627\u0644\u0635\u0648\u062a\u064a\u0629";Y["ar-eg"]["optionsLang_en-us"]="\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0627\u0644\u0648\u0644\u0627\u064a\u0627\u062a \u0627\u0644\u0645\u062a\u062d\u062f\u0629)";
Y["ar-eg"]["optionsLang_en-gb"]="\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u062a\u062d\u062f\u0629)";Y["ar-eg"]["optionsLang_nl-nl"]="\u0627\u0644\u0647\u0648\u0644\u0646\u062f\u064a\u0629";Y["ar-eg"].gameEndScreenTitle="\u062a\u0647\u0627\u0646\u064a\u0646\u0627!\n\u0644\u0642\u062f \u0623\u0643\u0645\u0644\u062a \u0627\u0644\u0644\u0639\u0628\u0629.";Y["ar-eg"].gameEndScreenBtnText="\u0645\u062a\u0627\u0628\u0639\u0629";
Y["ar-eg"].optionsTitle="\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a";Y["ar-eg"].optionsQuitConfirmationText="\u0627\u0646\u062a\u0628\u0647!n\n\u0625\u0630\u0627 \u062e\u0631\u062c\u062a \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629 \u0627\u0644\u0622\u0646\u060c \u0641\u0633\u062a\u0641\u0642\u062f \u0643\u0644 \u0627\u0644\u062a\u0642\u062f\u0645 \u0627\u0644\u0630\u064a \u0623\u062d\u0631\u0632\u062a\u0647 \u062e\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649. \u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0627\u0644\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629\u061f";
Y["ar-eg"].optionsQuitConfirmBtn_No="\u0644\u0627";Y["ar-eg"].optionsQuitConfirmBtn_Yes="\u0646\u0639\u0645\u060c \u0645\u062a\u0623\u0643\u062f";Y["ar-eg"].levelMapScreenTitle="\u062a\u062d\u062f\u064a\u062f \u0645\u0633\u062a\u0648\u0649";Y["ar-eg"].optionsRestartConfirmationText="\u0627\u0646\u062a\u0628\u0647!\n\n\u0625\u0630\u0627 \u0642\u0645\u062a \u0628\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0622\u0646\u060c \u0641\u0633\u062a\u0641\u0642\u062f \u0643\u0644 \u0627\u0644\u062a\u0642\u062f\u0645 \u0627\u0644\u0630\u064a \u0623\u062d\u0631\u0632\u062a\u0647 \u062e\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649. \u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u061f";
Y["ar-eg"].optionsRestart="\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644";Y["ar-eg"].optionsSFXBig_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0635\u0648\u062a";Y["ar-eg"].optionsSFXBig_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0635\u0648\u062a";Y["ar-eg"].optionsAbout_title="\u062d\u0648\u0644";Y["ar-eg"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["ar-eg"].optionsAbout_backBtn="\u0627\u0644\u0633\u0627\u0628\u0642";
Y["ar-eg"].optionsAbout_version="\u0627\u0644\u0625\u0635\u062f\u0627\u0631:";Y["ar-eg"].optionsAbout="\u062d\u0648\u0644";Y["ar-eg"].levelEndScreenMedal="\u0644\u0642\u062f \u062a\u062d\u0633\u0651\u0646\u062a!";Y["ar-eg"].startScreenQuestionaire="\u0645\u0627 \u0631\u0623\u064a\u0643\u061f";Y["ar-eg"].levelMapScreenWorld_0="\u062a\u062d\u062f\u064a\u062f \u0645\u0633\u062a\u0648\u0649";Y["ar-eg"].startScreenByTinglyGames="\u0628\u0648\u0627\u0633\u0637\u0629: CoolGames";
Y["ar-eg"]["optionsLang_de-de"]="\u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064a\u0629";Y["ar-eg"]["optionsLang_tr-tr"]="\u0627\u0644\u062a\u0631\u0643\u064a\u0629";Y["ar-eg"].optionsAbout_header="Developed by:";Y["ar-eg"].levelEndScreenViewHighscoreBtn="View scores";Y["ar-eg"].levelEndScreenSubmitHighscoreBtn="Submit score";Y["ar-eg"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["ar-eg"].challengeStartTextScore="<NAME>'s score:";
Y["ar-eg"].challengeStartTextTime="<NAME>'s time:";Y["ar-eg"].challengeStartScreenToWin="Amount to win:";Y["ar-eg"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["ar-eg"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["ar-eg"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["ar-eg"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["ar-eg"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["ar-eg"].challengeCancelConfirmBtn_yes="Yes";Y["ar-eg"].challengeCancelConfirmBtn_no="No";Y["ar-eg"].challengeEndScreensBtn_submit="Submit challenge";Y["ar-eg"].challengeEndScreenBtn_cancel="Cancel challenge";Y["ar-eg"].challengeEndScreenName_you="You";Y["ar-eg"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["ar-eg"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
Y["ar-eg"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["ar-eg"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["ar-eg"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["ar-eg"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["ar-eg"].challengeStartScreenTitle_challenger_friend="You are challenging:";
Y["ar-eg"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["ar-eg"].challengeStartTextTime_challenger="Play the game and set a time.";Y["ar-eg"].challengeStartTextScore_challenger="Play the game and set a score.";Y["ar-eg"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["ar-eg"].challengeForfeitConfirmBtn_yes="Yes";Y["ar-eg"].challengeForfeitConfirmBtn_no="No";Y["ar-eg"].challengeForfeitMessage_success="You have forfeited the challenge.";
Y["ar-eg"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["ar-eg"].optionsChallengeForfeit="Forfeit";Y["ar-eg"].optionsChallengeCancel="Quit";Y["ar-eg"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["ar-eg"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["ar-eg"].levelEndScreenHighScore_time="Best time:";Y["ar-eg"].levelEndScreenTotalScore_time="Total time:";
Y["ar-eg"]["optionsLang_fr-fr"]="\u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629";Y["ar-eg"]["optionsLang_ko-kr"]="\u0627\u0644\u0643\u0648\u0631\u064a\u0629";Y["ar-eg"]["optionsLang_ar-eg"]="\u0627\u0644\u0639\u0631\u0628\u064a\u0629";Y["ar-eg"]["optionsLang_es-es"]="\u0627\u0644\u0625\u0633\u0628\u0627\u0646\u064a\u0629";Y["ar-eg"]["optionsLang_pt-br"]="\u0627\u0644\u0628\u0631\u0627\u0632\u064a\u0644\u064a\u0629 - \u0627\u0644\u0628\u0631\u062a\u063a\u0627\u0644\u064a\u0629";
Y["ar-eg"]["optionsLang_ru-ru"]="\u0627\u0644\u0631\u0648\u0633\u064a\u0629";Y["ar-eg"].optionsExit="Exit";Y["ar-eg"].levelEndScreenTotalScore_number="Total score:";Y["ar-eg"].levelEndScreenHighScore_number="High score:";Y["ar-eg"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["ar-eg"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["ar-eg"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["ar-eg"].optionsAbout_header_publisher="Published by:";Y["ar-eg"]["optionsLang_jp-jp"]="Japanese";Y["ar-eg"]["optionsLang_it-it"]="Italian";Y["ko-kr"]=Y["ko-kr"]||{};Y["ko-kr"].loadingScreenLoading="\ubd88\ub7ec\uc624\uae30 \uc911...";
Y["ko-kr"].startScreenPlay="PLAY";Y["ko-kr"].levelMapScreenTotalScore="\ucd1d \uc810\uc218";Y["ko-kr"].levelEndScreenTitle_level="\ub808\ubca8 <VALUE>";Y["ko-kr"].levelEndScreenTitle_difficulty="\uc798 \ud588\uc5b4\uc694!";Y["ko-kr"].levelEndScreenTitle_endless="\uc2a4\ud14c\uc774\uc9c0 <VALUE>";Y["ko-kr"].levelEndScreenTotalScore="\ucd1d \uc810\uc218";Y["ko-kr"].levelEndScreenSubTitle_levelFailed="\ub808\ubca8 \uc2e4\ud328";Y["ko-kr"].levelEndScreenTimeLeft="\ub0a8\uc740 \uc2dc\uac04";
Y["ko-kr"].levelEndScreenTimeBonus="\uc2dc\uac04 \ubcf4\ub108\uc2a4";Y["ko-kr"].levelEndScreenHighScore="\ucd5c\uace0 \uc810\uc218";Y["ko-kr"].optionsStartScreen="\uba54\uc778 \uba54\ub274";Y["ko-kr"].optionsQuit="\uc885\ub8cc";Y["ko-kr"].optionsResume="\uacc4\uc18d";Y["ko-kr"].optionsTutorial="\uac8c\uc784 \ubc29\ubc95";Y["ko-kr"].optionsHighScore="\ucd5c\uace0 \uc810\uc218";Y["ko-kr"].optionsMoreGames="\ub354 \ub9ce\uc740 \uac8c\uc784";Y["ko-kr"].optionsDifficulty_easy="\uac04\ub2e8";
Y["ko-kr"].optionsDifficulty_medium="\uc911";Y["ko-kr"].optionsDifficulty_hard="\uc0c1";Y["ko-kr"].optionsMusic_on="\ucf1c\uae30";Y["ko-kr"].optionsMusic_off="\ub044\uae30";Y["ko-kr"].optionsSFX_on="\ucf1c\uae30";Y["ko-kr"].optionsSFX_off="\ub044\uae30";Y["ko-kr"]["optionsLang_en-us"]="\uc601\uc5b4(US)";Y["ko-kr"]["optionsLang_en-gb"]="\uc601\uc5b4(GB)";Y["ko-kr"]["optionsLang_nl-nl"]="\ub124\ub35c\ub780\ub4dc\uc5b4";Y["ko-kr"].gameEndScreenTitle="\ucd95\ud558\ud569\ub2c8\ub2e4!\n\uac8c\uc784\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.";
Y["ko-kr"].gameEndScreenBtnText="\uacc4\uc18d";Y["ko-kr"].optionsTitle="\uc124\uc815";Y["ko-kr"].optionsQuitConfirmationText="\uc8fc\uc758!\n\n\uc9c0\uae08 \uc885\ub8cc\ud558\uba74 \uc774 \ub808\ubca8\uc758 \ubaa8\ub4e0 \uc9c4\ud589 \ub0b4\uc6a9\uc744 \uc783\uac8c\ub429\ub2c8\ub2e4. \uc815\ub9d0 \uc885\ub8cc\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?";Y["ko-kr"].optionsQuitConfirmBtn_No="\uc544\ub2c8\uc624";Y["ko-kr"].optionsQuitConfirmBtn_Yes="\ub124, \ud655\uc2e4\ud569\ub2c8\ub2e4";
Y["ko-kr"].levelMapScreenTitle="\ub808\ubca8 \uc120\ud0dd";Y["ko-kr"].optionsRestartConfirmationText="\uc8fc\uc758!\n\n\uc9c0\uae08 \ub2e4\uc2dc \uc2dc\uc791\ud558\uba74 \uc774 \ub808\ubca8\uc758 \ubaa8\ub4e0 \uc9c4\ud589 \ub0b4\uc6a9\uc744 \uc783\uac8c\ub429\ub2c8\ub2e4. \uc815\ub9d0 \ub2e4\uc2dc \uc2dc\uc791\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?";Y["ko-kr"].optionsRestart="\ub2e4\uc2dc \uc2dc\uc791";Y["ko-kr"].optionsSFXBig_on="\uc74c\ud5a5 \ucf1c\uae30";Y["ko-kr"].optionsSFXBig_off="\uc74c\ud5a5 \ub044\uae30";
Y["ko-kr"].optionsAbout_title="\uad00\ub828 \uc815\ubcf4";Y["ko-kr"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["ko-kr"].optionsAbout_backBtn="\ub4a4\ub85c";Y["ko-kr"].optionsAbout_version="\ubc84\uc804:";Y["ko-kr"].optionsAbout="\uad00\ub828 \uc815\ubcf4";Y["ko-kr"].levelEndScreenMedal="\ud5a5\uc0c1\ud588\uad70\uc694!";Y["ko-kr"].startScreenQuestionaire="\uc5b4\ub5bb\uac8c \uc0dd\uac01\ud558\uc138\uc694?";Y["ko-kr"].levelMapScreenWorld_0="\ub808\ubca8 \uc120\ud0dd";
Y["ko-kr"].startScreenByTinglyGames="\uc81c\uc791: CoolGames";Y["ko-kr"]["optionsLang_de-de"]="\ub3c5\uc77c\uc5b4";Y["ko-kr"]["optionsLang_tr-tr"]="\ud130\ud0a4\uc5b4";Y["ko-kr"].optionsAbout_header="Developed by:";Y["ko-kr"].levelEndScreenViewHighscoreBtn="View scores";Y["ko-kr"].levelEndScreenSubmitHighscoreBtn="Submit score";Y["ko-kr"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";Y["ko-kr"].challengeStartTextScore="<NAME>'s score:";
Y["ko-kr"].challengeStartTextTime="<NAME>'s time:";Y["ko-kr"].challengeStartScreenToWin="Amount to win:";Y["ko-kr"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";Y["ko-kr"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["ko-kr"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["ko-kr"].challengeEndScreenOutcomeMessage_TIED="You tied.";Y["ko-kr"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["ko-kr"].challengeCancelConfirmBtn_yes="Yes";Y["ko-kr"].challengeCancelConfirmBtn_no="No";Y["ko-kr"].challengeEndScreensBtn_submit="Submit challenge";Y["ko-kr"].challengeEndScreenBtn_cancel="Cancel challenge";Y["ko-kr"].challengeEndScreenName_you="You";Y["ko-kr"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["ko-kr"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
Y["ko-kr"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";Y["ko-kr"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["ko-kr"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["ko-kr"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["ko-kr"].challengeStartScreenTitle_challenger_friend="You are challenging:";
Y["ko-kr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";Y["ko-kr"].challengeStartTextTime_challenger="Play the game and set a time.";Y["ko-kr"].challengeStartTextScore_challenger="Play the game and set a score.";Y["ko-kr"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["ko-kr"].challengeForfeitConfirmBtn_yes="Yes";Y["ko-kr"].challengeForfeitConfirmBtn_no="No";Y["ko-kr"].challengeForfeitMessage_success="You have forfeited the challenge.";
Y["ko-kr"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";Y["ko-kr"].optionsChallengeForfeit="Forfeit";Y["ko-kr"].optionsChallengeCancel="Quit";Y["ko-kr"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["ko-kr"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["ko-kr"].levelEndScreenHighScore_time="Best time:";Y["ko-kr"].levelEndScreenTotalScore_time="Total time:";
Y["ko-kr"]["optionsLang_fr-fr"]="\ud504\ub791\uc2a4\uc5b4";Y["ko-kr"]["optionsLang_ko-kr"]="\ud55c\uad6d\uc5b4";Y["ko-kr"]["optionsLang_ar-eg"]="\uc544\ub77c\ube44\uc544\uc5b4";Y["ko-kr"]["optionsLang_es-es"]="\uc2a4\ud398\uc778\uc5b4";Y["ko-kr"]["optionsLang_pt-br"]="\ud3ec\ub974\ud22c\uac08\uc5b4(\ube0c\ub77c\uc9c8)";Y["ko-kr"]["optionsLang_ru-ru"]="\ub7ec\uc2dc\uc544\uc5b4";Y["ko-kr"].optionsExit="Exit";Y["ko-kr"].levelEndScreenTotalScore_number="Total score:";
Y["ko-kr"].levelEndScreenHighScore_number="High score:";Y["ko-kr"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";Y["ko-kr"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";
Y["ko-kr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["ko-kr"].optionsAbout_header_publisher="Published by:";Y["ko-kr"]["optionsLang_jp-jp"]="Japanese";Y["ko-kr"]["optionsLang_it-it"]="Italian";Y["jp-jp"]=Y["jp-jp"]||{};Y["jp-jp"].loadingScreenLoading="\u30ed\u30fc\u30c9\u4e2d\u2026";Y["jp-jp"].startScreenPlay="\u30d7\u30ec\u30a4";Y["jp-jp"].levelMapScreenTotalScore="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2";Y["jp-jp"].levelEndScreenTitle_level="\u30ec\u30d9\u30eb <VALUE>";
Y["jp-jp"].levelEndScreenTitle_difficulty="\u3084\u3063\u305f\u306d\uff01";Y["jp-jp"].levelEndScreenTitle_endless="\u30b9\u30c6\u30fc\u30b8 <VALUE>";Y["jp-jp"].levelEndScreenTotalScore="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2";Y["jp-jp"].levelEndScreenSubTitle_levelFailed="\u30b2\u30fc\u30e0\u30aa\u30fc\u30d0\u30fc";Y["jp-jp"].levelEndScreenTimeLeft="\u6b8b\u308a\u6642\u9593";Y["jp-jp"].levelEndScreenTimeBonus="\u30bf\u30a4\u30e0\u30dc\u30fc\u30ca\u30b9";Y["jp-jp"].levelEndScreenHighScore="\u30cf\u30a4\u30b9\u30b3\u30a2";
Y["jp-jp"].optionsStartScreen="\u30e1\u30a4\u30f3\u30e1\u30cb\u30e5\u30fc";Y["jp-jp"].optionsQuit="\u3084\u3081\u308b";Y["jp-jp"].optionsResume="\u518d\u958b";Y["jp-jp"].optionsTutorial="\u3042\u305d\u3073\u65b9";Y["jp-jp"].optionsHighScore="\u30cf\u30a4\u30b9\u30b3\u30a2";Y["jp-jp"].optionsMoreGames="\u4ed6\u306e\u30b2\u30fc\u30e0";Y["jp-jp"].optionsDifficulty_easy="\u304b\u3093\u305f\u3093";Y["jp-jp"].optionsDifficulty_medium="\u3075\u3064\u3046";Y["jp-jp"].optionsDifficulty_hard="\u96e3\u3057\u3044";
Y["jp-jp"].optionsMusic_on="\u30aa\u30f3";Y["jp-jp"].optionsMusic_off="\u30aa\u30d5";Y["jp-jp"].optionsSFX_on="\u30aa\u30f3";Y["jp-jp"].optionsSFX_off="\u30aa\u30d5";Y["jp-jp"]["optionsLang_en-us"]="\u82f1\u8a9e\uff08\u7c73\u56fd\uff09";Y["jp-jp"]["optionsLang_en-gb"]="\u82f1\u8a9e\uff08\u82f1\u56fd\uff09";Y["jp-jp"]["optionsLang_nl-nl"]="\u30aa\u30e9\u30f3\u30c0\u8a9e";Y["jp-jp"].gameEndScreenTitle="\u304a\u3081\u3067\u3068\u3046\uff01\n\u3059\u3079\u3066\u306e\u30ec\u30d9\u30eb\u3092\u30af\u30ea\u30a2\u3057\u307e\u3057\u305f\u3002";
Y["jp-jp"].gameEndScreenBtnText="\u7d9a\u3051\u308b";Y["jp-jp"].optionsTitle="\u8a2d\u5b9a";Y["jp-jp"].optionsQuitConfirmationText="\u6ce8\u610f\uff01\n\n\u3053\u3053\u3067\u3084\u3081\u308b\u3068\n\u8a18\u9332\u304c\u30ea\u30bb\u30c3\u30c8\u3055\u308c\u307e\u3059\u304c\n\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f";Y["jp-jp"].optionsQuitConfirmBtn_No="\u3044\u3044\u3048\u3001\u7d9a\u3051\u307e\u3059\u3002";Y["jp-jp"].optionsQuitConfirmBtn_Yes="\u306f\u3044\u3001\u3084\u3081\u307e\u3059\u3002";
Y["jp-jp"].levelMapScreenTitle="\u30ec\u30d9\u30eb\u9078\u629e";Y["jp-jp"].optionsRestartConfirmationText="\u6ce8\u610f\uff01\n\n\u3053\u3053\u3067\u518d\u30b9\u30bf\u30fc\u30c8\u3059\u308b\u3068\n\u8a18\u9332\u304c\u30ea\u30bb\u30c3\u30c8\u3055\u308c\u307e\u3059\u304c\n\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f";Y["jp-jp"].optionsRestart="\u518d\u30b9\u30bf\u30fc\u30c8";Y["jp-jp"].optionsSFXBig_on="\u30b5\u30a6\u30f3\u30c9 \u30aa\u30f3";Y["jp-jp"].optionsSFXBig_off="\u30b5\u30a6\u30f3\u30c9 \u30aa\u30d5";
Y["jp-jp"].optionsAbout_title="About";Y["jp-jp"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";Y["jp-jp"].optionsAbout_backBtn="\u3082\u3069\u308b";Y["jp-jp"].optionsAbout_version="version";Y["jp-jp"].optionsAbout="About";Y["jp-jp"].levelEndScreenMedal="\u8a18\u9332\u66f4\u65b0\uff01";Y["jp-jp"].startScreenQuestionaire="\u3053\u306e\u30b2\u30fc\u30e0\u3078\u306e\u611f\u60f3";Y["jp-jp"].levelMapScreenWorld_0="\u30ec\u30d9\u30eb\u9078\u629e";Y["jp-jp"].startScreenByTinglyGames="by: CoolGames";
Y["jp-jp"]["optionsLang_de-de"]="\u30c9\u30a4\u30c4\u8a9e";Y["jp-jp"]["optionsLang_tr-tr"]="\u30c8\u30eb\u30b3\u8a9e";Y["jp-jp"].optionsAbout_header="Developed by";Y["jp-jp"].levelEndScreenViewHighscoreBtn="\u30b9\u30b3\u30a2\u3092\u307f\u308b";Y["jp-jp"].levelEndScreenSubmitHighscoreBtn="\u30b9\u30b3\u30a2\u9001\u4fe1";Y["jp-jp"].challengeStartScreenTitle_challengee_friend="\u304b\u3089\u6311\u6226\u3092\u53d7\u3051\u307e\u3057\u305f";Y["jp-jp"].challengeStartTextScore="<NAME>\u306e\u30b9\u30b3\u30a2";
Y["jp-jp"].challengeStartTextTime="<NAME>\u306e\u6642\u9593";Y["jp-jp"].challengeStartScreenToWin="\u30dd\u30a4\u30f3\u30c8\u6570";Y["jp-jp"].challengeEndScreenWinnings="<AMOUNT>\u30dd\u30a4\u30f3\u30c8\u7372\u5f97";Y["jp-jp"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";Y["jp-jp"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";Y["jp-jp"].challengeEndScreenOutcomeMessage_TIED="\u540c\u70b9";Y["jp-jp"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
Y["jp-jp"].challengeCancelConfirmBtn_yes="Yes";Y["jp-jp"].challengeCancelConfirmBtn_no="No";Y["jp-jp"].challengeEndScreensBtn_submit="\u3042";Y["jp-jp"].challengeEndScreenBtn_cancel="Cancel challenge";Y["jp-jp"].challengeEndScreenName_you="You";Y["jp-jp"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";Y["jp-jp"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";Y["jp-jp"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";
Y["jp-jp"].challengeCancelMessage_success="Your challenge has been cancelled.";Y["jp-jp"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";Y["jp-jp"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";Y["jp-jp"].challengeStartScreenTitle_challenger_friend="You are challenging:";Y["jp-jp"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
Y["jp-jp"].challengeStartTextTime_challenger="Play the game and set a time.";Y["jp-jp"].challengeStartTextScore_challenger="Play the game and set a score.";Y["jp-jp"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";Y["jp-jp"].challengeForfeitConfirmBtn_yes="Yes";Y["jp-jp"].challengeForfeitConfirmBtn_no="No";Y["jp-jp"].challengeForfeitMessage_success="You have forfeited the challenge.";Y["jp-jp"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
Y["jp-jp"].optionsChallengeForfeit="Forfeit";Y["jp-jp"].optionsChallengeCancel="Quit";Y["jp-jp"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";Y["jp-jp"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";Y["jp-jp"].levelEndScreenHighScore_time="Best time:";Y["jp-jp"].levelEndScreenTotalScore_time="Total time:";Y["jp-jp"]["optionsLang_fr-fr"]="French";Y["jp-jp"]["optionsLang_ko-kr"]="Korean";Y["jp-jp"]["optionsLang_ar-eg"]="Arabic";
Y["jp-jp"]["optionsLang_es-es"]="Spanish";Y["jp-jp"]["optionsLang_pt-br"]="Brazilian-Portuguese";Y["jp-jp"]["optionsLang_ru-ru"]="Russian";Y["jp-jp"].optionsExit="Exit";Y["jp-jp"].levelEndScreenTotalScore_number="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2:";Y["jp-jp"].levelEndScreenHighScore_number="\u30cf\u30a4\u30b9\u30b3\u30a2:";Y["jp-jp"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
Y["jp-jp"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";Y["jp-jp"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";Y["jp-jp"].optionsAbout_header_publisher="Published by:";Y["jp-jp"]["optionsLang_jp-jp"]="\u65e5\u672c\u8a9e";Y["jp-jp"]["optionsLang_it-it"]="Italian";Y["it-it"]=Y["it-it"]||{};Y["it-it"].loadingScreenLoading="Caricamento...";
Y["it-it"].startScreenPlay="GIOCA";Y["it-it"].levelMapScreenTotalScore="Punteggio totale";Y["it-it"].levelEndScreenTitle_level="Livello <VALUE>";Y["it-it"].levelEndScreenTitle_difficulty="Ottimo lavoro!";Y["it-it"].levelEndScreenTitle_endless="Livello <VALUE>";Y["it-it"].levelEndScreenTotalScore="Punteggio totale";Y["it-it"].levelEndScreenSubTitle_levelFailed="Non hai superato il livello";Y["it-it"].levelEndScreenTimeLeft="Tempo rimanente";Y["it-it"].levelEndScreenTimeBonus="Tempo bonus";
Y["it-it"].levelEndScreenHighScore="Record";Y["it-it"].optionsStartScreen="Menu principale";Y["it-it"].optionsQuit="Esci";Y["it-it"].optionsResume="Riprendi";Y["it-it"].optionsTutorial="Come si gioca";Y["it-it"].optionsHighScore="Record";Y["it-it"].optionsMoreGames="Altri giochi";Y["it-it"].optionsDifficulty_easy="Facile";Y["it-it"].optionsDifficulty_medium="Media";Y["it-it"].optionsDifficulty_hard="Difficile";Y["it-it"].optionsMusic_on="S\u00ec";Y["it-it"].optionsMusic_off="No";
Y["it-it"].optionsSFX_on="S\u00ec";Y["it-it"].optionsSFX_off="No";Y["it-it"]["optionsLang_en-us"]="Inglese (US)";Y["it-it"]["optionsLang_en-gb"]="Inglese (UK)";Y["it-it"]["optionsLang_nl-nl"]="Olandese";Y["it-it"].gameEndScreenTitle="Congratulazioni!\nHai completato il gioco.";Y["it-it"].gameEndScreenBtnText="Continua";Y["it-it"].optionsTitle="Impostazioni";Y["it-it"].optionsQuitConfirmationText="Attenzione!\n\nSe abbandoni ora, perderai tutti i progressi ottenuti in questo livello. Confermi?";
Y["it-it"].optionsQuitConfirmBtn_No="No";Y["it-it"].optionsQuitConfirmBtn_Yes="S\u00ec, ho deciso";Y["it-it"].levelMapScreenTitle="Scegli un livello";Y["it-it"].optionsRestartConfirmationText="Attenzione!\n\nSe riavvii ora, perderai tutti i progressi ottenuti in questo livello. Confermi?";Y["it-it"].optionsRestart="Riavvia";Y["it-it"].optionsSFXBig_on="Audio S\u00cc";Y["it-it"].optionsSFXBig_off="Audio NO";Y["it-it"].optionsAbout_title="Informazioni";Y["it-it"].optionsAbout_text="CoolGames\nwww.coolgames.com\n\u00a9 2020";
Y["it-it"].optionsAbout_backBtn="Indietro";Y["it-it"].optionsAbout_version="versione:";Y["it-it"].optionsAbout="Informazioni";Y["it-it"].levelEndScreenMedal="MIGLIORATO!";Y["it-it"].startScreenQuestionaire="Che ne pensi?";Y["it-it"].levelMapScreenWorld_0="Scegli un livello";Y["it-it"].startScreenByTinglyGames="di: CoolGames";Y["it-it"]["optionsLang_de-de"]="Tedesco";Y["it-it"]["optionsLang_tr-tr"]="Turco";Y["it-it"].optionsAbout_header="Sviluppato da:";Y["it-it"].levelEndScreenViewHighscoreBtn="Guarda i punteggi";
Y["it-it"].levelEndScreenSubmitHighscoreBtn="Invia il punteggio";Y["it-it"].challengeStartScreenTitle_challengee_friend="Hai ricevuto una sfida da:";Y["it-it"].challengeStartTextScore="punteggio di <NAME>:";Y["it-it"].challengeStartTextTime="tempo di <NAME>:";Y["it-it"].challengeStartScreenToWin="Necessario per vincere:";Y["it-it"].challengeEndScreenWinnings="Hai vinto <AMOUNT> fairpoint";Y["it-it"].challengeEndScreenOutcomeMessage_WON="Hai vinto la sfida!";
Y["it-it"].challengeEndScreenOutcomeMessage_LOST="Hai perso la sfida.";Y["it-it"].challengeEndScreenOutcomeMessage_TIED="Hai pareggiato.";Y["it-it"].challengeCancelConfirmText="Stai per annullare la sfida. Recupererai la posta, tranne la quota di partecipazione alla sfida. Confermi?";Y["it-it"].challengeCancelConfirmBtn_yes="S\u00ec";Y["it-it"].challengeCancelConfirmBtn_no="No";Y["it-it"].challengeEndScreensBtn_submit="Invia la sfida";Y["it-it"].challengeEndScreenBtn_cancel="Annulla la sfida";
Y["it-it"].challengeEndScreenName_you="Tu";Y["it-it"].challengeEndScreenChallengeSend_error="Impossibile inviare la sfida. Riprova pi\u00f9 tardi.";Y["it-it"].challengeEndScreenChallengeSend_success="Sfida inviata!";Y["it-it"].challengeCancelMessage_error="Impossibile annullare la sfida. Riprova pi\u00f9 tardi.";Y["it-it"].challengeCancelMessage_success="Sfida annullata.";Y["it-it"].challengeEndScreenScoreSend_error="Impossibile comunicare col server. Riprova pi\u00f9 tardi.";
Y["it-it"].challengeStartScreenTitle_challengee_stranger="Sei stato abbinato a:";Y["it-it"].challengeStartScreenTitle_challenger_friend="Stai sfidando:";Y["it-it"].challengeStartScreenTitle_challenger_stranger="Stai impostando un punteggio da battere per:";Y["it-it"].challengeStartTextTime_challenger="Gioca e imposta un tempo da battere.";Y["it-it"].challengeStartTextScore_challenger="Gioca e imposta un punteggio da superare.";Y["it-it"].challengeForfeitConfirmText="Stai per abbandonare la sfida. Confermi?";
Y["it-it"].challengeForfeitConfirmBtn_yes="S\u00ec";Y["it-it"].challengeForfeitConfirmBtn_no="No";Y["it-it"].challengeForfeitMessage_success="Hai abbandonato la sfida.";Y["it-it"].challengeForfeitMessage_error="Impossibile abbandonare la sfida. Riprova pi\u00f9 tardi.";Y["it-it"].optionsChallengeForfeit="Abbandona";Y["it-it"].optionsChallengeCancel="Esci";Y["it-it"].challengeLoadingError_notValid="La sfida non \u00e8 pi\u00f9 valida.";Y["it-it"].challengeLoadingError_notStarted="Impossibile connettersi al server. Riprova pi\u00f9 tardi.";
Y["it-it"].levelEndScreenHighScore_time="Miglior tempo:";Y["it-it"].levelEndScreenTotalScore_time="Tempo totale:";Y["it-it"]["optionsLang_fr-fr"]="Francese";Y["it-it"]["optionsLang_ko-kr"]="Coreano";Y["it-it"]["optionsLang_ar-eg"]="Arabo";Y["it-it"]["optionsLang_es-es"]="Spagnolo";Y["it-it"]["optionsLang_pt-br"]="Brasiliano - Portoghese";Y["it-it"]["optionsLang_ru-ru"]="Russo";Y["it-it"].optionsExit="Esci";Y["it-it"].levelEndScreenTotalScore_number="Punteggio totale:";
Y["it-it"].levelEndScreenHighScore_number="Record:";Y["it-it"].challengeEndScreenChallengeSend_submessage="<NAME> ha a disposizione 72 ore per accettare o rifiutare la tua sfida. Se la rifiuta, o non la accetta entro 72 ore, recupererai la posta e la quota di partecipazione alla sfida.";Y["it-it"].challengeEndScreenChallengeSend_submessage_stranger="Se nessuno accetta la tua sfida entro 72 ore, recuperi la posta e la quota di partecipazione alla sfida.";
Y["it-it"].challengeForfeitMessage_winnings="<NAME> ha vinto <AMOUNT> fairpoint!";Y["it-it"].optionsAbout_header_publisher="Distribuito da:";Y["it-it"]["optionsLang_jp-jp"]="Giapponese";Y["it-it"]["optionsLang_it-it"]="Italiano";Y=Y||{};Y["nl-nl"]=Y["nl-nl"]||{};Y["nl-nl"].game_ui_SCORE="SCORE";Y["nl-nl"].game_ui_STAGE="LEVEL";Y["nl-nl"].game_ui_LIVES="LEVENS";Y["nl-nl"].game_ui_TIME="TIJD";Y["nl-nl"].game_ui_HIGHSCORE="HIGH SCORE";Y["nl-nl"].game_ui_LEVEL="LEVEL";Y["nl-nl"].game_ui_time_left="Resterende tijd";
Y["nl-nl"].game_ui_TIME_TO_BEAT="DOELTIJD";Y["nl-nl"].game_ui_SCORE_TO_BEAT="DOELSCORE";Y["nl-nl"].game_ui_HIGHSCORE_break="HIGH\nSCORE";Y["en-us"]=Y["en-us"]||{};Y["en-us"].game_ui_SCORE="SCORE";Y["en-us"].game_ui_STAGE="STAGE";Y["en-us"].game_ui_LIVES="LIVES";Y["en-us"].game_ui_TIME="TIME";Y["en-us"].game_ui_HIGHSCORE="HIGH SCORE";Y["en-us"].game_ui_LEVEL="LEVEL";Y["en-us"].game_ui_time_left="Time left";Y["en-us"].game_ui_TIME_TO_BEAT="TIME TO BEAT";Y["en-us"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";
Y["en-us"].game_ui_HIGHSCORE_break="HIGH\nSCORE";Y["en-gb"]=Y["en-gb"]||{};Y["en-gb"].game_ui_SCORE="SCORE";Y["en-gb"].game_ui_STAGE="STAGE";Y["en-gb"].game_ui_LIVES="LIVES";Y["en-gb"].game_ui_TIME="TIME";Y["en-gb"].game_ui_HIGHSCORE="HIGH SCORE";Y["en-gb"].game_ui_LEVEL="LEVEL";Y["en-gb"].game_ui_time_left="Time left";Y["en-gb"].game_ui_TIME_TO_BEAT="TIME TO BEAT";Y["en-gb"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";Y["en-gb"].game_ui_HIGHSCORE_break="HIGH\nSCORE";Y["de-de"]=Y["de-de"]||{};
Y["de-de"].game_ui_SCORE="PUNKTE";Y["de-de"].game_ui_STAGE="STUFE";Y["de-de"].game_ui_LIVES="LEBEN";Y["de-de"].game_ui_TIME="ZEIT";Y["de-de"].game_ui_HIGHSCORE="HIGHSCORE";Y["de-de"].game_ui_LEVEL="LEVEL";Y["de-de"].game_ui_time_left="Restzeit";Y["de-de"].game_ui_TIME_TO_BEAT="ZEITVORGABE";Y["de-de"].game_ui_SCORE_TO_BEAT="Zu schlagende Punktzahl";Y["de-de"].game_ui_HIGHSCORE_break="HIGHSCORE";Y["fr-fr"]=Y["fr-fr"]||{};Y["fr-fr"].game_ui_SCORE="SCORE";Y["fr-fr"].game_ui_STAGE="SC\u00c8NE";
Y["fr-fr"].game_ui_LIVES="VIES";Y["fr-fr"].game_ui_TIME="TEMPS";Y["fr-fr"].game_ui_HIGHSCORE="MEILLEUR SCORE";Y["fr-fr"].game_ui_LEVEL="NIVEAU";Y["fr-fr"].game_ui_time_left="Temps restant";Y["fr-fr"].game_ui_TIME_TO_BEAT="TEMPS \u00c0 BATTRE";Y["fr-fr"].game_ui_SCORE_TO_BEAT="SCORE \u00c0 BATTRE";Y["fr-fr"].game_ui_HIGHSCORE_break="MEILLEUR\nSCORE";Y["pt-br"]=Y["pt-br"]||{};Y["pt-br"].game_ui_SCORE="PONTOS";Y["pt-br"].game_ui_STAGE="FASE";Y["pt-br"].game_ui_LIVES="VIDAS";Y["pt-br"].game_ui_TIME="TEMPO";
Y["pt-br"].game_ui_HIGHSCORE="RECORDE";Y["pt-br"].game_ui_LEVEL="N\u00cdVEL";Y["pt-br"].game_ui_time_left="Tempo restante";Y["pt-br"].game_ui_TIME_TO_BEAT="HORA DE ARRASAR";Y["pt-br"].game_ui_SCORE_TO_BEAT="RECORDE A SER SUPERADO";Y["pt-br"].game_ui_HIGHSCORE_break="RECORDE";Y["es-es"]=Y["es-es"]||{};Y["es-es"].game_ui_SCORE="PUNTOS";Y["es-es"].game_ui_STAGE="FASE";Y["es-es"].game_ui_LIVES="VIDAS";Y["es-es"].game_ui_TIME="TIEMPO";Y["es-es"].game_ui_HIGHSCORE="R\u00c9CORD";
Y["es-es"].game_ui_LEVEL="NIVEL";Y["es-es"].game_ui_time_left="Tiempo restante";Y["es-es"].game_ui_TIME_TO_BEAT="TIEMPO OBJETIVO";Y["es-es"].game_ui_SCORE_TO_BEAT="PUNTUACI\u00d3N OBJETIVO";Y["es-es"].game_ui_HIGHSCORE_break="R\u00c9CORD";Y["tr-tr"]=Y["tr-tr"]||{};Y["tr-tr"].game_ui_SCORE="SKOR";Y["tr-tr"].game_ui_STAGE="B\u00d6L\u00dcM";Y["tr-tr"].game_ui_LIVES="HAYATLAR";Y["tr-tr"].game_ui_TIME="S\u00dcRE";Y["tr-tr"].game_ui_HIGHSCORE="Y\u00dcKSEK SKOR";Y["tr-tr"].game_ui_LEVEL="SEV\u0130YE";
Y["tr-tr"].game_ui_time_left="Kalan zaman";Y["tr-tr"].game_ui_TIME_TO_BEAT="B\u0130T\u0130RME ZAMANI";Y["tr-tr"].game_ui_SCORE_TO_BEAT="B\u0130T\u0130RME PUANI";Y["tr-tr"].game_ui_HIGHSCORE_break="Y\u00dcKSEK\nSKOR";Y["ru-ru"]=Y["ru-ru"]||{};Y["ru-ru"].game_ui_SCORE="\u0420\u0415\u0417\u0423\u041b\u042c\u0422\u0410\u0422";Y["ru-ru"].game_ui_STAGE="\u042d\u0422\u0410\u041f";Y["ru-ru"].game_ui_LIVES="\u0416\u0418\u0417\u041d\u0418";Y["ru-ru"].game_ui_TIME="\u0412\u0420\u0415\u041c\u042f";
Y["ru-ru"].game_ui_HIGHSCORE="\u0420\u0415\u041a\u041e\u0420\u0414";Y["ru-ru"].game_ui_LEVEL="\u0423\u0420\u041e\u0412\u0415\u041d\u042c";Y["ru-ru"].game_ui_time_left="Time left";Y["ru-ru"].game_ui_TIME_TO_BEAT="TIME TO BEAT";Y["ru-ru"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";Y["ru-ru"].game_ui_HIGHSCORE_break="\u0420\u0415\u041a\u041e\u0420\u0414";Y["ar-eg"]=Y["ar-eg"]||{};Y["ar-eg"].game_ui_SCORE="\u0627\u0644\u0646\u062a\u064a\u062c\u0629";Y["ar-eg"].game_ui_STAGE="\u0645\u0631\u062d\u0644\u0629";
Y["ar-eg"].game_ui_LIVES="\u0639\u062f\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0627\u062a";Y["ar-eg"].game_ui_TIME="\u0627\u0644\u0648\u0642\u062a";Y["ar-eg"].game_ui_HIGHSCORE="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";Y["ar-eg"].game_ui_LEVEL="\u0645\u0633\u062a\u0648\u0649";Y["ar-eg"].game_ui_time_left="Time left";Y["ar-eg"].game_ui_TIME_TO_BEAT="TIME TO BEAT";Y["ar-eg"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";Y["ar-eg"].game_ui_HIGHSCORE_break="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";
Y["ko-kr"]=Y["ko-kr"]||{};Y["ko-kr"].game_ui_SCORE="\uc810\uc218";Y["ko-kr"].game_ui_STAGE="\uc2a4\ud14c\uc774\uc9c0";Y["ko-kr"].game_ui_LIVES="\uae30\ud68c";Y["ko-kr"].game_ui_TIME="\uc2dc\uac04";Y["ko-kr"].game_ui_HIGHSCORE="\ucd5c\uace0 \uc810\uc218";Y["ko-kr"].game_ui_LEVEL="\ub808\ubca8";Y["ko-kr"].game_ui_time_left="Time left";Y["ko-kr"].game_ui_TIME_TO_BEAT="TIME TO BEAT";Y["ko-kr"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";Y["ko-kr"].game_ui_HIGHSCORE_break="\ucd5c\uace0 \uc810\uc218";
Y["jp-jp"]=Y["jp-jp"]||{};Y["jp-jp"].game_ui_SCORE="\u30b9\u30b3\u30a2";Y["jp-jp"].game_ui_STAGE="\u30b9\u30c6\u30fc\u30b8";Y["jp-jp"].game_ui_LIVES="\u30e9\u30a4\u30d5";Y["jp-jp"].game_ui_TIME="\u30bf\u30a4\u30e0";Y["jp-jp"].game_ui_HIGHSCORE="\u30cf\u30a4\u30b9\u30b3\u30a2";Y["jp-jp"].game_ui_LEVEL="\u30ec\u30d9\u30eb";Y["jp-jp"].game_ui_time_left="\u6b8b\u308a\u6642\u9593";Y["jp-jp"].game_ui_TIME_TO_BEAT="\u30af\u30ea\u30a2\u307e\u3067\u3042\u3068";Y["jp-jp"].game_ui_SCORE_TO_BEAT="\u30af\u30ea\u30a2\u307e\u3067\u3042\u3068";
Y["jp-jp"].game_ui_HIGHSCORE_break="\u30cf\u30a4\n\u30b9\u30b3\u30a2";Y["it-it"]=Y["it-it"]||{};Y["it-it"].game_ui_SCORE="PUNTEGGIO";Y["it-it"].game_ui_STAGE="FASE";Y["it-it"].game_ui_LIVES="VITE";Y["it-it"].game_ui_TIME="TEMPO";Y["it-it"].game_ui_HIGHSCORE="RECORD";Y["it-it"].game_ui_LEVEL="LIVELLO";Y["it-it"].game_ui_time_left="TEMPO RIMANENTE";Y["it-it"].game_ui_TIME_TO_BEAT="TEMPO DA BATTERE";Y["it-it"].game_ui_SCORE_TO_BEAT="PUNTEGGIO DA BATTERE";Y["it-it"].game_ui_HIGHSCORE_break="RECORD";
var Xe={};
function Ye(){Xe={Md:{oe:"en-us",ij:"en-us en-gb nl-nl de-de fr-fr pt-br es-es tr-tr ru-ru ar-eg ko-kr jp-jp it-it".split(" ")},Cd:{uc:P(1040),$p:P(960),Mb:P(640),ng:P(640),cf:P(0),wk:P(-80),bf:0,minHeight:P(780),km:{id:"canvasBackground",depth:50},Lc:{id:"canvasGame",depth:100,top:P(200,"round"),left:P(40,"round"),width:P(560,"round"),height:P(560,"round")},rc:{id:"canvasGameUI",depth:150,top:0,left:0,height:P(120,"round")},Ye:{id:"canvasMain",depth:200}},lm:{uc:P(640),$p:P(640),Mb:P(1152),ng:P(1152),
cf:P(0),wk:P(0),bf:0,minHeight:P(640),minWidth:P(850),km:{id:"canvasBackground",depth:50},Lc:{id:"canvasGame",depth:100,top:P(40,"round"),left:P(296,"round"),width:P(560,"round"),height:P(560,"round")},rc:{id:"canvasGameUI",depth:150,top:0,left:P(151),width:P(140)},Ye:{id:"canvasMain",depth:200}},Kb:{bigPlay:{type:"text",s:Vd,sa:P(38),gb:P(99),font:{align:"center",h:"middle",fontSize:Q({big:46,small:30}),fillColor:"#01198a",S:{i:!0,color:"#7bfdff",offsetX:0,offsetY:2,blur:0}},Fc:2,Gc:P(30),fontSize:Q({big:46,
small:30})},difficulty_toggle:{type:"toggleText",s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"0",s:Ic,N:"optionsDifficulty_easy"},{id:"1",s:Hc,N:"optionsDifficulty_medium"},{id:"2",s:Gc,N:"optionsDifficulty_hard"}],Pg:P(30),Qg:P(12),Pf:P(10),Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})},music_toggle:{type:"toggle",s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,
small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"on",s:Od,N:"optionsMusic_on"},{id:"off",s:Nd,N:"optionsMusic_off"}],Pg:P(30),Qg:P(12),Pf:0,Fc:2,Gc:P(30)},sfx_toggle:{type:"toggle",s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"on",s:Md,N:"optionsSFX_on"},{id:"off",s:Ld,N:"optionsSFX_off"}],Pg:P(30),Qg:P(12),Pf:0,Fc:2,Gc:P(30)},music_big_toggle:{type:"toggleText",
s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"on",s:"undefined"!==typeof Dd?Dd:void 0,N:"optionsMusic_on"},{id:"off",s:"undefined"!==typeof Ed?Ed:void 0,N:"optionsMusic_off"}],Pg:P(28,"round"),Qg:P(10),Pf:P(10),Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})},sfx_big_toggle:{type:"toggleText",s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",
S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"on",s:"undefined"!==typeof Bd?Bd:void 0,N:"optionsSFXBig_on"},{id:"off",s:"undefined"!==typeof Cd?Cd:void 0,N:"optionsSFXBig_off"}],Pg:P(33,"round"),Qg:P(12),Pf:P(10),Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})},language_toggle:{type:"toggleText",s:Kd,sa:P(106),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},T:[{id:"en-us",s:Jc,N:"optionsLang_en-us"},
{id:"en-gb",s:Kc,N:"optionsLang_en-gb"},{id:"nl-nl",s:Lc,N:"optionsLang_nl-nl"},{id:"de-de",s:Nc,N:"optionsLang_de-de"},{id:"fr-fr",s:Oc,N:"optionsLang_fr-fr"},{id:"pt-br",s:Pc,N:"optionsLang_pt-br"},{id:"es-es",s:Qc,N:"optionsLang_es-es"},{id:"ru-ru",s:Sc,N:"optionsLang_ru-ru"},{id:"it-it",s:Vc,N:"optionsLang_it-it"},{id:"ar-eg",s:Tc,N:"optionsLang_ar-eg"},{id:"ko-kr",s:Uc,N:"optionsLang_ko-kr"},{id:"tr-tr",s:Mc,N:"optionsLang_tr-tr"},{id:"jp-jp",s:Rc,N:"optionsLang_jp-jp"}],Pg:P(40),Qg:P(20),Pf:P(10),
Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})},default_text:{type:"text",s:Jd,sa:P(40),gb:P(40),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})},default_image:{type:"image",s:Jd,sa:P(40),gb:P(40),Gc:P(6)},options:{type:"image",s:Hd}},jm:{bigPlay:{type:"text",s:Vd,sa:P(40),gb:P(76),font:{align:"center",h:"middle",fontSize:Q({big:40,small:20}),fillColor:"#01198a",S:{i:!0,
color:"#7bfdff",offsetX:0,offsetY:2,blur:0}},Fc:2,Gc:P(30),fontSize:Q({big:40,small:20})}},rj:{green:{font:{align:"center",h:"middle",fillColor:"#018a17",S:{i:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}}},blue:{font:{align:"center",h:"middle",fillColor:"#01198a",S:{i:!0,color:"#7bfdff",offsetX:0,offsetY:2,blur:0}}},bluegreen:{font:{align:"center",h:"middle",fillColor:"#004f89",S:{i:!0,color:"#7bffca",offsetX:0,offsetY:2,blur:0}}},orange:{font:{align:"center",h:"middle",fillColor:"#9a1900",S:{i:!0,
color:"#ffb986",offsetX:0,offsetY:2,blur:0}}},orangeyellow:{font:{align:"center",h:"middle",fillColor:"#8d2501",S:{i:!0,color:"#ffbe60",offsetX:0,offsetY:2,blur:0}}},pink:{font:{align:"center",h:"middle",fillColor:"#c6258f",S:{i:!0,color:"#ffbde9",offsetX:0,offsetY:2,blur:0}}},white:{font:{align:"center",h:"middle",fillColor:"#ffffff"}},pastel_pink:{font:{align:"center",h:"middle",fillColor:"#83574f"}},whiteWithRedBorder:{font:{align:"center",h:"middle",fillColor:"#ffffff",S:{i:!0,color:"#4c0200",
offsetX:0,offsetY:2,blur:0}}},whiteWithBlueBorder:{font:{align:"center",h:"middle",fillColor:"#ffffff",S:{i:!0,color:"#002534",offsetX:0,offsetY:2,blur:0}}}},buttons:{default_color:"green"},Ba:{Fx:20},Rc:{backgroundImage:"undefined"!==typeof Td?Td:void 0,Wv:0,Vt:500,qk:5E3,Gv:5E3,os:-1,Dx:12,Cx:100,Yd:P(78),Fo:{align:"center"},rl:P(560),xg:P(400),yg:{align:"center"},xf:P(680),re:P(16),xn:P(18),mi:P(8),wr:P(8),xr:P(9),yr:P(9),Ii:{align:"center",fillColor:"#3B0057",fontSize:P(24)},Ss:{align:"center"},
Ts:P(620),ql:P(500),ni:"center",zf:P(500),pi:P(60),vb:{align:"center"},ic:{align:"bottom",offset:P(20)},Cn:P(806),An:500,wv:P(20)},zn:{ni:"right",rl:P(280),xf:P(430),zf:P(340),vb:{align:"right",offset:P(32)},ic:P(560),Cn:P(560)},wo:{hm:P(860),backgroundImage:void 0!==typeof Td?Td:void 0,Du:700,Nr:1800,Sv:700,sw:2600,rg:void 0!==typeof Td?Yd:void 0,Pc:700,bi:{align:"center"},Tj:{align:"center"},ci:void 0!==typeof Yd?-Yd.height:0,ai:{align:"top",offset:P(20)},Xm:1,Bq:1,Ym:1,Cq:1,Wm:1,Aq:1,Hu:M,Iu:gc,
Fu:M,Gu:M,Eu:M,rw:{align:"center"},Uk:P(656),xi:P(300),Sk:700,qw:700,cq:P(368),Cj:P(796),Sh:P(440),bq:700,Jn:P(36),vk:P(750),Rv:500,ni:"center",zf:P(500),pi:P(60),vb:{align:"center"},ic:{align:"bottom",offset:P(20)},Cn:P(806),An:500,wv:P(20)},xo:{hm:P(0),Uk:P(456),xi:P(320),cq:{align:"center"},Cj:P(346),Sh:P(460),Jn:{align:"left",offset:P(32)},vk:P(528),ni:"right",zf:P(340),vb:{align:"right",offset:P(32)},ic:P(560),Cn:P(560)},uf:{jw:{align:"center",offset:P(-230)},Rn:{align:"top",offset:P(576)},iw:"options",
Hc:{h:"bottom"},Uf:{align:"center"},Ic:{align:"top",offset:P(35,"round")},vd:P(232),Ie:P(98),Zx:{align:"center",offset:P(-206)},Zo:{align:"top",offset:P(30)},Yx:{align:"center",offset:P(206)},Yo:{align:"top",offset:P(30)},type:"grid",fw:3,Qz:3,gw:5,Rz:4,fq:!0,nu:!0,fn:P(78),Gq:{align:"top",offset:P(140)},Iq:{align:"top",offset:P(140)},Hq:P(20),Ou:P(18),Pu:P(18),kv:{bn:{fontSize:Q({big:60,small:30}),fillColor:"#3F4F5E",align:"center",h:"middle",S:{i:!0,color:"#D0D8EA",offsetX:0,offsetY:P(6),blur:0}}},
lv:{bn:{fontSize:Q({big:32,small:16}),fillColor:"#3F4F5E",align:"center",h:"middle",S:{i:!0,color:"#D0D8EA",offsetX:0,offsetY:P(2),blur:0}}},sr:P(438),tr:P(438),jr:{align:"center"},kr:{align:"center"},Ar:{align:"center"},Br:{align:"center",offset:P(-22)},nr:{align:"center"},or:{align:"center",offset:P(-10)},ex:{align:"center",offset:P(216)},ts:{align:"top",offset:P(574)},ss:{fontSize:Q({big:24,small:12}),fillColor:"#3F4F5E",align:"center"},us:P(10),Yn:{fontSize:Q({big:24,small:12}),fillColor:"#3F4F5E",
align:"center"},Wr:{align:"center"},Xr:{align:"top",offset:P(588)},vw:P(160),uw:P(40),backgroundImage:"undefined"!==typeof s_screen_levelselect?s_screen_levelselect:void 0,yx:P(10),zx:200,xx:P(200),oz:P(600),aw:800,$v:500},lr:{Zo:{align:"top",offset:P(20)},Yo:{align:"top",offset:P(20)},Ic:{align:"top",offset:P(25,"round")},fn:P(234),Gq:{align:"top",offset:P(110)},Iq:{align:"top",offset:P(110)},ts:{align:"top",offset:P(536)},Xr:{align:"top",offset:P(550)},Rn:{align:"top",offset:P(538)}},lk:{Bc:"undefined"!==
typeof Rd?Rd:void 0,Sr:{align:"center"},Ik:"undefined"!==typeof Rd?-Rd.height:void 0,ui:[{type:"y",va:0,duration:800,end:{align:"center",offset:P(-142)},Ma:gc,Rb:Me}],Hk:[{type:"y",va:0,duration:600,end:"undefined"!==typeof Rd?-Rd.height:void 0,Ma:fc,qj:!0}],wp:{align:"center",h:"middle"},xp:{align:"center"},yp:0,Ch:P(500),Xl:P(80),Kq:{align:"center",h:"middle"},Mq:{align:"center"},Nq:0,ck:P(560),Lq:P(80),Ur:3500},wn:{ui:[{type:"y",va:0,duration:800,end:{align:"center"},Ma:gc,Rb:Me}]},wy:{Bc:"undefined"!==
typeof s_overlay_challenge_start?s_overlay_challenge_start:void 0,Sr:{align:"center"},Ik:P(56),Kk:0,Lk:0,Hc:{align:"center",h:"top"},vd:P(500),Ie:P(100),Uf:{align:"center"},Ic:P(90),zz:{align:"center",h:"middle"},Ez:P(500),Dz:P(80),Iz:{align:"center"},Jz:P(250),sA:{align:"center",h:"top"},uA:P(500),tA:P(40),vA:{align:"center"},wA:P(348),rA:{align:"center",h:"top"},yA:P(500),xA:P(50),AA:{align:"center"},BA:P(388),iB:{align:"center",h:"top"},kB:P(500),jB:P(40),nB:{align:"center"},oB:P(442),lB:0,mB:0,
hB:{align:"center",h:"top"},qB:P(500),pB:P(50),rB:{align:"center"},sB:P(482),gB:P(10),eB:0,fB:0,Bh:800,Ul:gc,Vl:600,Wl:fc,Ur:3500},vy:{cy:500,Bh:800,Nz:1500,Oz:500,zA:2500,EA:500,CA:3200,DA:800,uz:4200,vz:300,ny:4500,Wz:{align:"center"},Xz:P(-800),Uz:{align:"center"},Vz:P(52),Kk:0,Lk:0,Kj:.8,pq:"#000000",Kn:{align:"center",h:"middle"},wz:P(360),rz:P(120),sz:P(4),tz:P(4),xz:{align:"center"},yz:P(340),QA:{align:"center"},RA:P(600),PA:P(500),OA:P(120),NA:{align:"center",h:"middle"},tB:{align:"center",
h:"middle"},xB:P(360),uB:P(60),vB:P(4),wB:P(4),yB:{align:"center"},zB:P(480),WA:P(460),SA:{align:"center"},TA:P(400),oy:{align:"center"},py:P(500),Lz:{align:"center",h:"middle"},Mz:P(75,"round"),Kz:P(48),Pz:P(120),Hz:P(214,"round"),Az:P(40),Bz:P(4),Cz:P(4),Fz:0,Gz:0,Ny:{align:"center",h:"middle"},Qy:P(220),Py:P(180),Oy:P(80),Ly:P(4),My:P(4)},ia:{Jk:{Rh:"undefined"!==typeof Wd?Wd:void 0,su:"undefined"!==typeof s_overlay_endless?s_overlay_endless:void 0,mv:"undefined"!==typeof s_overlay_level_win?s_overlay_level_win:
void 0,jv:"undefined"!==typeof s_overlay_level_fail?s_overlay_level_fail:void 0},Bx:500,Bh:800,Ul:gc,Vl:800,Wl:bc,Db:{align:"center"},Eb:0,Hc:{align:"center",h:"middle",fontSize:Q({big:26,small:13})},Uf:{align:"center"},Ic:P(58),vd:P(500),Ie:P(100),Es:{align:"center",h:"middle",fontSize:Q({big:56,small:28})},tx:{align:"center"},ux:P(236),Cm:{align:"center",h:"top",fontSize:Q({big:24,small:12})},jq:{align:"center"},Dm:P(144),Th:{align:"center",h:"top",fontSize:Q({big:56,small:28})},Ij:{align:"center"},
Uh:P(176),Hj:P(200),Gj:P(60),Fi:{align:"center",h:"top",fontSize:Q({big:24,small:12})},Ae:{align:"center"},Lf:P(286),As:P(0),vq:!1,Xc:P(14),ll:P(10),Kf:{align:"center",h:"top",fontSize:Q({big:24,small:12})},Ig:P(10),Jg:P(4),Kg:P(200),MA:P(50),Tt:{align:"center",offset:P(12)},Bp:P(549),Bu:{align:"center",offset:P(162)},wq:P(489),Kh:{align:"center",offset:P(250)},kg:P(10),jg:P(90),af:P(90),qo:{align:"center",offset:P(-177,"round")},ro:P(120),so:{align:"center"},to:P(96),uo:{align:"center",offset:P(179,
"round")},vo:P(120),KA:200,ax:500,ps:800,rs:0,dx:0,cx:300,bx:200,qs:300,Kj:.8,Wb:800,pq:"#000000",Hn:P(508),uk:P(394),Dr:P(96),Er:P(74),sk:3,zg:400,Hv:2500,qz:0,Kv:P(100),Fr:1.5,Pv:{align:"center"},Qv:P(76),tk:P(180),Ov:P(36),Gr:{align:"center",h:"middle",fontSize:Q({big:22,small:12}),O:"ff_opensans_extrabold",fillColor:"#1d347f",S:{i:!0,color:"#68cbfa",offsetY:P(2)}},Cr:500,Iv:500,Jv:P(-30),Mv:500,Lv:0,Nv:4E3,ul:600,Nx:1500,Kp:500,gg:750,Yu:{align:"center"},Zu:P(290),Rq:P(350),Yv:1E3,type:{level:{mj:"level",
Dc:!0,Gg:!0,Ji:"title_level",Be:"totalScore",jj:"retry",Oj:"next"},failed:{mj:"failed",Dc:!1,Gg:!1,Ji:"title_level",Fs:"subtitle_failed",jj:"exit",Oj:"retry"},endless:{mj:"endless",Dc:!1,Gg:!0,Ji:"title_endless",Em:"totalScore",Be:"highScore",jj:"exit",Oj:"retry"},difficulty:{mj:"difficulty",Dc:!1,Gg:!0,Ji:"title_difficulty",Em:"timeLeft",Be:["totalScore","timeBonus"],jj:"exit",Oj:"retry"}}},ir:{kg:P(0),Ic:P(30),Dm:P(114),Uh:P(146),Lf:P(266),Bp:P(488),wq:P(428),Hn:{align:"center",offset:P(220)},uk:P(260)},
ji:{backgroundImage:"undefined"!==typeof Xd?Xd:void 0},options:{backgroundImage:Ud,Db:{align:"center"},Eb:0,Hc:{},Uf:{align:"center"},Ic:P(58),vd:P(500),Ie:P(100),tj:P(460,"round"),sj:{align:"center"},Gh:{align:"center",offset:P(36)},dd:P(10,"round"),Kh:P(510),kg:P(10),jg:P(130),af:P(90),buttons:{startScreen:["tutorial",["music","sfx"],"language","moreGames","about"],levelMapScreen:["startScreen",["music","sfx"],"language","moreGames","about"],inGame:["resume","tutorial",["music","sfx"],"moreGames",
"quit"]},si:800,ti:gc,Fk:600,Gk:bc,Wp:{align:"center"},rm:P(260),yj:P(460),qm:P(300),Up:{align:"center"},pm:P(460),Tp:{align:"center"},om:P(560,"round"),Mh:P(460,"round"),Zk:{},$c:"undefined"!==typeof Sd?Sd:void 0,wl:{align:"center"},Je:P(84,"round"),yl:{align:"center",h:"top"},zl:P(480),Oo:P(46),kt:{align:"center"},Po:P(110,"round"),ht:{align:"center"},Mo:P(160,"round"),jt:{align:"center"},No:P(446,"round"),xl:{h:"middle",align:"center",fontSize:Q({big:36,small:18})},Tg:P(480),it:P(160),gt:{align:"center",
offset:P(-80,"round")},Lo:P(556,"round"),ft:{align:"center",offset:P(80,"round")},Ko:P(556,"round"),cj:{align:"center",h:"top",fillColor:"#3C0058",fontSize:Q({big:26,small:13}),ta:P(6)},dj:P(480),pp:P(50),ej:{align:"center"},vh:P(106,"round"),xh:{align:"center",h:"top",fillColor:"#3C0058",fontSize:Q({big:26,small:13}),ta:P(6)},Se:P(480),yh:P(110),cg:{align:"center"},zh:P(396,"round"),wh:{align:"center"},fj:P(140),Ql:{align:"center"},th:P(500),uh:P(480),Rl:{align:"center",h:"top",fillColor:"#808080",
fontSize:Q({big:12,small:8})},sp:{align:"center"},Sl:P(610),rp:P(440),qp:P(20),dg:P(200),gj:P(200),tt:P(80),ut:P(140),st:P(10)},kw:{Ic:P(12),Gh:{align:"center",offset:P(16)},rm:P(200),qm:P(300),pm:P(400),om:P(500,"round"),Je:P(60,"round"),Po:P(80,"round"),Mo:P(134,"round"),No:P(410,"round"),Lo:P(500,"round"),Ko:P(500,"round"),vh:P(86,"round"),fj:P(126),zh:P(392,"round"),th:P(490),Sl:P(590)},Or:{backgroundImage:"undefined"!==typeof s_overlay_challenge_options?s_overlay_challenge_options:Ud,Db:{align:"center"},
Eb:P(120),Hc:{},Uf:{align:"center"},Ic:P(200),tj:P(460,"round"),sj:{align:"center"},Gh:{align:"center",offset:P(140)},dd:P(10,"round"),Kh:P(510),kg:P(10),jg:P(130),af:P(90),buttons:{startScreen:["tutorial",["music","sfx"],"language","about"],inGame_challengee:["resume","tutorial",["music","sfx"],"forfeitChallenge"],inGame_challenger:["resume","tutorial",["music","sfx"],"cancelChallenge"]},si:800,ti:gc,Fk:600,Gk:bc,Zk:{},kA:{align:"center"},lA:P(360),jA:P(460),iA:P(300),eA:"default_text",fA:{align:"center"},
gA:P(630),bA:"default_text",cA:{align:"center"},dA:P(730,"round"),hA:P(460,"round"),Vp:{},Wp:{align:"center"},rm:P(200),yj:P(460),qm:P(250),Up:{align:"center"},pm:P(520),Tp:{align:"center"},om:P(620,"round"),Mh:P(460,"round"),Kn:{},Uv:{align:"center"},Vv:P(200),Ln:P(460),Tv:P(300),$c:"undefined"!==typeof Sd?Sd:void 0,wl:{align:"center"},Je:P(0,"round"),yl:{align:"center",h:"top"},zl:P(480),Oo:P(50),kt:{align:"center"},Po:P(20,"round"),ht:{align:"center"},Mo:P(70,"round"),jt:{align:"center"},No:P(356,
"round"),xl:{h:"middle",align:"center",fontSize:Q({big:36,small:18})},Tg:P(480),it:P(150),gt:P(224,"round"),Lo:P(636,"round"),ft:P(350,"round"),Ko:P(636,"round"),cj:{align:"center",h:"top",fillColor:"#3C0058",fontSize:Q({big:26,small:13}),ta:P(6)},dj:P(480),pp:P(50),ej:{align:"center"},vh:P(26,"round"),xh:{align:"center",h:"top",fillColor:"#3C0058",fontSize:Q({big:26,small:13}),ta:P(6)},Se:P(480),yh:P(110),cg:{align:"center"},zh:P(316,"round"),wh:{align:"center"},fj:P(60),Ql:{align:"center"},th:P(420),
uh:P(480),Rl:{align:"center",h:"top",fillColor:"#808080",fontSize:Q({big:12,small:8})},sp:{align:"center"},Sl:P(530),rp:P(440),qp:P(20),dg:P(200),gj:P(200),tt:P(80),ut:P(100),st:P(10)},vm:{backgroundImage:"undefined"!==typeof s_overlay_dialog?s_overlay_dialog:Ud,Db:{align:"center"},Eb:P(120),tj:P(460,"round"),sj:{align:"center"},Gh:{align:"bottom",offset:P(20)},dd:P(10,"round"),Kh:P(510),kg:P(10),jg:P(130),af:P(90),si:800,ti:gc,Fk:600,Gk:bc,$r:{},Dw:{align:"center"},Ew:{align:"center",offset:P(40)},
ao:P(460),$n:P(300),Ds:{},Bw:{align:"center"},Cw:{align:"center",offset:P(160)},Aw:P(460),zw:P(200)},Rj:{backgroundImage:"undefined"!==typeof s_screen_end?s_screen_end:void 0,Ss:{align:"center"},Ts:P(152),ql:P(560),Ax:P(560),font:{align:"center",h:"middle",fontSize:Q({big:52,small:26}),fillColor:"#FFFFFF"},au:{align:"center"},Np:P(600),Mp:P(460),Lp:"default_text"},Rm:{Np:P(520)}}}
var Ze={xw:"poki",Ci:{uv:!1,xm:[]},Md:{oe:"en-us",ij:"en-us en-gb nl-nl de-de fr-fr pt-br es-es tr-tr ru-ru ar-eg ko-kr".split(" ")},Gp:{show:!1}},$e=null;
function af(){$e={debug:{ou:!1,pu:!1,nx:!1},Nm:{offset:P(-4,"round"),Bf:P(278,"round"),Cf:P(52,"round")},kf:{Sm:"Solitaire",ld:"difficulty",Ir:["resume","tutorial","sfx_big","restart","quit"]},iv:{Qx:P(877,"round"),Rx:P(877,"round"),Sx:P(28,"round"),Tx:P(28,"round")},Zb:{Lj:P(0,"round"),Mj:P(20,"round"),offset:P(-4,"round"),Bf:P(38,"round"),Cf:P(170,"round")},Sb:{Bf:P(38,"round"),Cf:P(52,"round")},la:{Lj:P(20,"round"),Mj:P(0,"round"),Bf:P(118,"round"),Cf:P(52,"round")},mm:{qu:500,shadowOffsetX:P(4,
"round"),shadowOffsetY:P(4,"round")},pd:{Yp:P(198,"round"),Zp:P(52,"round"),pw:350,Vn:300,rx:500,sx:50},kb:{Pt:150,Qt:200,ty:!0,Qp:400,wm:!0,Ky:100,mu:500,ym:400,Hw:50,eo:500,Ix:50,Jx:300,Kx:180,Lx:-50,Mx:500},mz:3,rr:[{name:"EASY",Kd:{Wh:1,Ao:!0,Wn:!1},R:{oe:500,sn:36E4,Io:1E3,Un:0,Ek:30,move:0,Ak:10,Mn:-50,yk:25,Im:0,co:-200,an:0,gm:1E3,em:10,Qo:-50}},{name:"MEDIUM",Kd:{Wh:1,Ao:!0,Wn:!0},R:{oe:1E3,sn:36E4,Io:1E3,Un:0,Ek:60,move:0,Ak:20,Mn:-100,yk:50,Im:0,co:-400,an:0,gm:1E3,em:20,Qo:-50}},{name:"HARD",
Kd:{Wh:3,Ao:!0,Wn:!0},R:{oe:1500,sn:36E4,Io:1E3,Un:0,Ek:90,move:0,Ak:30,Mn:-150,yk:75,Im:0,co:-600,an:0,gm:1E3,em:30,Qo:-50}}]}}Y=Y||{};Y["nl-nl"]=Y["nl-nl"]||{};Y["nl-nl"].TutorialText_0="Je kan kaarten van de ene rij naar een andere rij verplaatsen.";Y["nl-nl"].TutorialTitle_0="Speluitleg";Y["nl-nl"].levelStartText="Speel alle kaarten van het veld weg.";Y["nl-nl"].levelStartHeader="Doel";Y["nl-nl"].TutorialText_1="Je mag alleen afwisselende kleuren op elkaar leggen. Zwart op rood op zwart...";
Y["nl-nl"].TutorialText_2="En je mag alleen aflopende kaarten op elkaar leggen.";Y["nl-nl"].TutorialText_3="Rechtsboven mag je azen wegleggen.";Y["nl-nl"].TutorialText_4="Op de stapels bovenaan mag je alleen oplopende kaarten van dezelfde kleur leggen.";Y["nl-nl"].TutorialTitle_1="Zwart op rood";Y["nl-nl"].TutorialTitle_2="Aflopend";Y["nl-nl"].TutorialTitle_3="Azen";Y["nl-nl"].TutorialTitle_4="Stapels bovenaan";Y["nl-nl"].TutorialTitle_5="Winnen";Y["nl-nl"].optionsDifficulty_hard="3 kaarten delen";
Y["nl-nl"].optionsDifficulty_medium="1 kaart delen";Y["nl-nl"].optionsDifficulty_easy="Vrije plaatsing";Y["en-us"]=Y["en-us"]||{};Y["en-us"].TutorialText_0="You can move cards from one stack to another.";Y["en-us"].TutorialTitle_0="How to play";Y["en-us"].levelStartText="Clear the field of all cards.";Y["en-us"].levelStartHeader="Goal";Y["en-us"].TutorialText_1="You are only allowed to stack cards that alternate in color. Black on red on black...";Y["en-us"].TutorialText_2="And you can only place descending cards on top of each other.";
Y["en-us"].TutorialText_3="At the top you can place aces.";Y["en-us"].TutorialText_4="In the top stacks you are allowed to place ascending cards of the same suite.";Y["en-us"].TutorialTitle_1="Black on red";Y["en-us"].TutorialTitle_2="Descending";Y["en-us"].TutorialTitle_3="Aces";Y["en-us"].TutorialTitle_4="Top stack";Y["en-us"].TutorialTitle_5="Winning";Y["en-us"].optionsDifficulty_hard="3 card draw";Y["en-us"].optionsDifficulty_medium="1 card draw";Y["en-us"].optionsDifficulty_easy="Free placement";
Y["en-gb"]=Y["en-gb"]||{};Y["en-gb"].TutorialText_0="You can move cards from one stack to another.";Y["en-gb"].TutorialTitle_0="How to play";Y["en-gb"].levelStartText="Clear the field of all cards.";Y["en-gb"].levelStartHeader="Goal";Y["en-gb"].TutorialText_1="You are only allowed to stack cards that alternate in color. Black on red on black...";Y["en-gb"].TutorialText_2="And you can only place descending cards on top of each other.";Y["en-gb"].TutorialText_3="At the top you can place aces.";
Y["en-gb"].TutorialText_4="In the top stacks you are allowed to place ascending cards of the same suite.";Y["en-gb"].TutorialTitle_1="Black on red";Y["en-gb"].TutorialTitle_2="Descending";Y["en-gb"].TutorialTitle_3="Aces";Y["en-gb"].TutorialTitle_4="Top stack";Y["en-gb"].TutorialTitle_5="Winning";Y["en-gb"].optionsDifficulty_hard="3 card draw";Y["en-gb"].optionsDifficulty_medium="1 card draw";Y["en-gb"].optionsDifficulty_easy="Free placement";Y["de-de"]=Y["de-de"]||{};Y["de-de"].TutorialText_0="Du kannst die Karten von einem Stapel auf einen anderen umlegen.";
Y["de-de"].TutorialTitle_0="So wird gespielt";Y["de-de"].levelStartText="Entferne alle Karten vom Spielfeld.";Y["de-de"].levelStartHeader="Ziel";Y["de-de"].TutorialText_1="Du darfst Karten nur in abwechselnder Farbfolge ablegen. Schwarz auf Rot auf Schwarz ...";Y["de-de"].TutorialText_2="Und du kannst Karten nur in absteigender Reihenfolge aufeinander legen.";Y["de-de"].TutorialText_3="Ganz oben legst du die Asse ab.";Y["de-de"].TutorialText_4="Auf die oberen Stapel darfst du Karten derselben Farbe in aufsteigender Reihenfolge legen.";
Y["de-de"].TutorialTitle_1="Schwarz auf Rot";Y["de-de"].TutorialTitle_2="Absteigend";Y["de-de"].TutorialTitle_3="Asse";Y["de-de"].TutorialTitle_4="Oberster Stapel";Y["de-de"].TutorialTitle_5="Gewinnen";Y["de-de"].optionsDifficulty_hard="3 Karten ziehen";Y["de-de"].optionsDifficulty_medium="1 Karte ziehen";Y["de-de"].optionsDifficulty_easy="Freie Platzierung";Y["fr-fr"]=Y["fr-fr"]||{};Y["fr-fr"].TutorialText_0="Vous pouvez d\u00e9placer les cartes d'une pile \u00e0 une autre.";
Y["fr-fr"].TutorialTitle_0="Comment jouer";Y["fr-fr"].levelStartText="Faites dispara\u00eetre toutes les cartes.";Y["fr-fr"].levelStartHeader="Objectif";Y["fr-fr"].TutorialText_1="Vous ne pouvez empiler une carte que sur la couleur oppos\u00e9e. Rouge sur noir sur rouge, etc.";Y["fr-fr"].TutorialText_2="Et vous ne pouvez mettre qu'une carte de valeur inf\u00e9rieure sur une autre.";Y["fr-fr"].TutorialText_3="Au sommet de la pile, vous pouvez mettre un as.";Y["fr-fr"].TutorialText_4="Sur les quatre piles situ\u00e9es en haut \u00e0 droite, vous pouvez placer les cartes de m\u00eame couleur, de l'as vers le roi.";
Y["fr-fr"].TutorialTitle_1="Noir sur rouge";Y["fr-fr"].TutorialTitle_2="Du roi vers l'as";Y["fr-fr"].TutorialTitle_3="As";Y["fr-fr"].TutorialTitle_4="Pile du haut";Y["fr-fr"].TutorialTitle_5="Victoire";Y["fr-fr"].optionsDifficulty_hard="Pioche de 3 cartes";Y["fr-fr"].optionsDifficulty_medium="Pioche d'1 carte";Y["fr-fr"].optionsDifficulty_easy="Placement libre";Y["pt-br"]=Y["pt-br"]||{};Y["pt-br"].TutorialText_0="Voc\u00ea pode mover as cartas de uma pilha para outra.";
Y["pt-br"].TutorialTitle_0="Como jogar";Y["pt-br"].levelStartText="Tire todas as cartas da mesa.";Y["pt-br"].levelStartHeader="Objetivo";Y["pt-br"].TutorialText_1="Voc\u00ea s\u00f3 pode empilhar as cartas em cores alternadas. Pretas, vermelhas, pretas...";Y["pt-br"].TutorialText_2="E voc\u00ea s\u00f3 pode posicion\u00e1-las em cima uma das outras em ordem decrescente.";Y["pt-br"].TutorialText_3="No topo, s\u00e3o os ases.";Y["pt-br"].TutorialText_4="Nas pilhas de cima, voc\u00ea pode colocar cartas do mesmo naipe, em ordem crescente.";
Y["pt-br"].TutorialTitle_1="Pretas sobre vermelhas";Y["pt-br"].TutorialTitle_2="Decrescente";Y["pt-br"].TutorialTitle_3="Ases";Y["pt-br"].TutorialTitle_4="Pilha de cima";Y["pt-br"].TutorialTitle_5="Vencer";Y["pt-br"].optionsDifficulty_hard="Tirar 3 cartas";Y["pt-br"].optionsDifficulty_medium="Tirar 1 carta";Y["pt-br"].optionsDifficulty_easy="Posi\u00e7\u00f5es livres";Y["es-es"]=Y["es-es"]||{};Y["es-es"].TutorialText_0="Puedes mover cartas de una pila a otra.";Y["es-es"].TutorialTitle_0="C\u00f3mo jugar";
Y["es-es"].levelStartText="Quitar todas las cartas";Y["es-es"].levelStartHeader="Objetivo";Y["es-es"].TutorialText_1="Solo puedes colocar cartas de colores alternos. Negro en rojo en negro...";Y["es-es"].TutorialText_2="Solo puedes colocar cartas de valores descendentes encima de otras.";Y["es-es"].TutorialText_3="Puedes colocar los ases arriba. ";Y["es-es"].TutorialText_4="En las pilas superiores, solo puedes colocar cartas de valor ascendente del mismo palo.";Y["es-es"].TutorialTitle_1="Negro sobre rojo";
Y["es-es"].TutorialTitle_2="Descendente";Y["es-es"].TutorialTitle_3="Ases";Y["es-es"].TutorialTitle_4="Pilas superiores";Y["es-es"].TutorialTitle_5="Ganar";Y["es-es"].optionsDifficulty_hard="Sacar 3 cartas";Y["es-es"].optionsDifficulty_medium="Sacar 1 carta";Y["es-es"].optionsDifficulty_easy="Despliegue libre";Y["tr-tr"]=Y["tr-tr"]||{};Y["tr-tr"].TutorialText_0="Kartlar\u0131 bir desteden di\u011ferine koyabilirsin.";Y["tr-tr"].TutorialTitle_0="Nas\u0131l oynan\u0131r";Y["tr-tr"].levelStartText="Alandan t\u00fcm kartlar\u0131 sil.";
Y["tr-tr"].levelStartHeader="Hedef";Y["tr-tr"].TutorialText_1="Sadece alternatif renklere sahip kartlar\u0131 desteye koyabilirsin. Siyah k\u0131rm\u0131z\u0131da, k\u0131rm\u0131z\u0131 siyahta...";Y["tr-tr"].TutorialText_2="Ve sadece azalan kartlar\u0131 birbirinin \u00fcst\u00fcne koyabilirsin.";Y["tr-tr"].TutorialText_3="En tepede as kullanabilirsin.";Y["tr-tr"].TutorialText_4="\u00dcst destelerde ayn\u0131 tak\u0131mdan artan kartlar\u0131 koyabilirsin.";Y["tr-tr"].TutorialTitle_1="K\u0131rm\u0131z\u0131 \u00fcst\u00fcnde siyah";
Y["tr-tr"].TutorialTitle_2="Azalan";Y["tr-tr"].TutorialTitle_3="Aslar";Y["tr-tr"].TutorialTitle_4="\u00dcst deste";Y["tr-tr"].TutorialTitle_5="Kazan\u0131yor";Y["tr-tr"].optionsDifficulty_hard="3 kart \u00e7ekme";Y["tr-tr"].optionsDifficulty_medium="1 kart \u00e7ekme";Y["tr-tr"].optionsDifficulty_easy="Bedava yerle\u015ftirme";Y["ru-ru"]=Y["ru-ru"]||{};Y["ru-ru"].TutorialText_0="\u041a\u0430\u0440\u0442\u044b \u043c\u043e\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0430\u0442\u044c \u0438\u0437 \u043e\u0434\u043d\u043e\u0439 \u0441\u0442\u043e\u043f\u043a\u0438 \u0432 \u0434\u0440\u0443\u0433\u0443\u044e.";
Y["ru-ru"].TutorialTitle_0="\u041a\u0430\u043a \u0438\u0433\u0440\u0430\u0442\u044c";Y["ru-ru"].levelStartText="\u0423\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0441\u0435 \u043a\u0430\u0440\u0442\u044b \u0441 \u043f\u043e\u043b\u044f.";Y["ru-ru"].levelStartHeader="\u0426\u0435\u043b\u044c";Y["ru-ru"].TutorialText_1="\u041a\u0430\u0440\u0442\u044b \u0441\u043a\u043b\u0430\u0434\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u0432 \u0441\u0442\u043e\u043f\u043a\u0438 \u043f\u043e \u043f\u0440\u0438\u043d\u0446\u0438\u043f\u0443 \u0447\u0435\u0440\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u044f \u0446\u0432\u0435\u0442\u043e\u0432. \u0427\u0435\u0440\u043d\u0430\u044f \u043c\u0430\u0441\u0442\u044c, \u043f\u043e\u0442\u043e\u043c \u043a\u0440\u0430\u0441\u043d\u0430\u044f, \u043f\u043e\u0442\u043e\u043c \u0447\u0435\u0440\u043d\u0430\u044f \u0438 \u0442.\u0434.";
Y["ru-ru"].TutorialText_2="\u041a\u0430\u0440\u0442\u044b \u043f\u043e\u043c\u0435\u0449\u0430\u044e\u0442\u0441\u044f \u0432 \u0441\u0442\u043e\u043f\u043a\u0438 \u0432 \u043f\u043e\u0440\u044f\u0434\u043a\u0435 \u0443\u0431\u044b\u0432\u0430\u043d\u0438\u044f.";Y["ru-ru"].TutorialText_3="\u0421\u0432\u0435\u0440\u0445\u0443 \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u044e\u0442\u0441\u044f \u0442\u0443\u0437\u044b.";Y["ru-ru"].TutorialText_4="\u0412 \u0432\u0435\u0440\u0445\u043d\u0438\u0445 \u0441\u0442\u043e\u043f\u043a\u0430\u0445 \u043c\u043e\u0436\u043d\u043e \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u0442\u044c \u043a\u0430\u0440\u0442\u044b \u043e\u0434\u043d\u043e\u0439 \u043c\u0430\u0441\u0442\u0438 \u043f\u043e \u0432\u043e\u0437\u0440\u0430\u0441\u0442\u0430\u043d\u0438\u044e.";
Y["ru-ru"].TutorialTitle_1="\u0427\u0435\u0440\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u0435 \u0446\u0432\u0435\u0442\u043e\u0432";Y["ru-ru"].TutorialTitle_2="\u0423\u0431\u044b\u0432\u0430\u043d\u0438\u0435";Y["ru-ru"].TutorialTitle_3="\u0422\u0443\u0437\u044b";Y["ru-ru"].TutorialTitle_4="\u0412\u0435\u0440\u0445\u043d\u044f\u044f \u0441\u0442\u043e\u043f\u043a\u0430";Y["ru-ru"].TutorialTitle_5="\u041f\u043e\u0431\u0435\u0434\u0430";Y["ru-ru"].optionsDifficulty_hard="3 \u043a\u0430\u0440\u0442\u044b \u0437\u0430 \u0440\u0430\u0437";
Y["ru-ru"].optionsDifficulty_medium="1 \u043a\u0430\u0440\u0442\u0430 \u0437\u0430 \u0440\u0430\u0437";Y["ru-ru"].optionsDifficulty_easy="\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0435 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435";Y["ar-eg"]=Y["ar-eg"]||{};Y["ar-eg"].TutorialText_0="\u064a\u0645\u0643\u0646\u0643 \u0646\u0642\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0645\u0646 \u0631\u0632\u0645\u0629 \u0648\u0627\u062d\u062f\u0629 \u0625\u0644\u0649 \u0623\u062e\u0631\u0649.";
Y["ar-eg"].TutorialTitle_0="\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0644\u0639\u0628";Y["ar-eg"].levelStartText="\u0642\u0645 \u0628\u0625\u062e\u0644\u0627\u0621 \u0627\u0644\u062d\u0642\u0644 \u0645\u0646 \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a";Y["ar-eg"].levelStartHeader="\u0627\u0644\u0647\u062f\u0641";Y["ar-eg"].TutorialText_1="\u064a\u064f\u0633\u0645\u062d \u0644\u0643 \u0641\u0642\u0637 \u0628\u062a\u0643\u062f\u064a\u0633 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u062a\u0646\u0627\u0648\u0628 \u0641\u064a \u0627\u0644\u0644\u0648\u0646. \u0623\u0633\u0648\u062f \u0639\u0644\u0649 \u0623\u062d\u0645\u0631 \u0639\u0644\u0649 \u0623\u0633\u0648\u062f...";
Y["ar-eg"].TutorialText_2="\u0648\u064a\u0645\u0643\u0646\u0643 \u0641\u0642\u0637 \u0648\u0636\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0628\u0639\u0636\u0647\u0627 \u0641\u0648\u0642 \u0628\u0639\u0636 \u0628\u062a\u0631\u062a\u064a\u0628 \u062a\u0646\u0627\u0632\u0644\u064a.";Y["ar-eg"].TutorialText_3="\u0641\u064a \u0627\u0644\u062c\u0632\u0621 \u0627\u0644\u0639\u0644\u0648\u064a \u064a\u0645\u0643\u0646\u0643 \u0648\u0636\u0639 \u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0622\u0635.";
Y["ar-eg"].TutorialText_4="\u0641\u064a \u0631\u064f\u0632\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0639\u0644\u0648\u064a\u0629\u060c \u064a\u064f\u0633\u0645\u062d \u0644\u0643 \u0628\u0648\u0636\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0645\u0646 \u0646\u0641\u0633 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0628\u062a\u0631\u062a\u064a\u0628 \u062a\u0646\u0627\u0632\u0644\u064a.";Y["ar-eg"].TutorialTitle_1="\u0623\u0633\u0648\u062f \u0639\u0644\u0649 \u0623\u062d\u0645\u0631";
Y["ar-eg"].TutorialTitle_2="\u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u062a\u0646\u0627\u0632\u0644\u064a";Y["ar-eg"].TutorialTitle_3="\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0622\u0635";Y["ar-eg"].TutorialTitle_4="\u0631\u064f\u0632\u0645\u0629 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0639\u0644\u0648\u064a\u0629";Y["ar-eg"].TutorialTitle_5="\u0627\u0644\u0641\u0648\u0632";Y["ar-eg"].optionsDifficulty_hard="\u0635\u0639\u0628 (\u064a\u062a\u0645 \u0633\u062d\u0628 \u062b\u0644\u0627\u062b \u0628\u0637\u0627\u0642\u0627\u062a)";
Y["ar-eg"].optionsDifficulty_medium="\u0645\u062a\u0648\u0633\u0637 (\u064a\u062a\u0645 \u0633\u062d\u0628 \u0628\u0637\u0627\u0642\u0629 \u0648\u0627\u062d\u062f\u0629)";Y["ar-eg"].optionsDifficulty_easy="\u0633\u0647\u0644";Y["ko-kr"]=Y["ko-kr"]||{};Y["ko-kr"].TutorialText_0="\ud558\ub098\uc758 \uc2a4\ud0dd\uc5d0\uc11c \ub2e4\ub978 \uc2a4\ud0dd\uc73c\ub85c \uce74\ub4dc\ub97c \uc774\ub3d9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";Y["ko-kr"].TutorialTitle_0="\uac8c\uc784 \ubc29\ubc95";
Y["ko-kr"].levelStartText="\ubaa8\ub4e0 \uce74\ub4dc\uc640 \ud544\ub4dc\ub97c \uc815\ub9ac\ud569\ub2c8\ub2e4.";Y["ko-kr"].levelStartHeader="\ubaa9\ud45c";Y["ko-kr"].TutorialText_1="\ub2e4\ub978 \uc0c9\uae54\uc758 \uce74\ub4dc\ub9cc\uc744 \uc313\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \uac80\uc740 \uc0c9 \uc704\uc5d0 \ube68\uac04\uc0c9 \uc704\uc5d0 \uac80\uc740 \uc0c9...";Y["ko-kr"].TutorialText_2="\uac01 \uc0c1\ub2e8\uc758 \ub0b4\ub9bc\ucc28\uc21c \uce74\ub4dc\ub9cc \ubc30\uce58\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";
Y["ko-kr"].TutorialText_3="\ucd5c\uc0c1\ub2e8\uc5d0\ub294 \uc5d0\uc774\uc2a4\ub97c \ubc30\uce58\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";Y["ko-kr"].TutorialText_4="\ucd5c\uc0c1\ub2e8 \uc2a4\ud0dd\uc5d0\uc11c\ub294 \uac19\uc740 \ubaa8\uc591\uc758 \uce74\ub4dc\ub97c \uc624\ub984\ucc28\uc21c\uc73c\ub85c \ubc30\uce58\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";Y["ko-kr"].TutorialTitle_1="\ube68\uac15 \uc704 \uac80\uc815";Y["ko-kr"].TutorialTitle_2="\ub0b4\ub9bc\ucc28\uc21c";Y["ko-kr"].TutorialTitle_3="\uc5d0\uc774\uc2a4";
Y["ko-kr"].TutorialTitle_4="\uc0c1\ub2e8 \uc2a4\ud0dd";Y["ko-kr"].TutorialTitle_5="\uc2b9\ub9ac";Y["ko-kr"].optionsDifficulty_hard="\uce74\ub4dc 3\uac1c \ubf51\uae30";Y["ko-kr"].optionsDifficulty_medium="\uce74\ub4dc 1\uac1c \ubf51\uae30";Y["ko-kr"].optionsDifficulty_easy="\uc790\uc720 \ubc30\uce58";Y["jp-jp"]=Y["jp-jp"]||{};Y["jp-jp"].TutorialText_0="\u30ab\u30fc\u30c9\u3092\u79fb\u52d5\u3055\u305b\u3066\u904a\u307c\u3046";Y["jp-jp"].TutorialTitle_0="\u3042\u305d\u3073\u65b9";
Y["jp-jp"].levelStartText="\u30ab\u30fc\u30c9\u3092\u5168\u3066\u88cf\u8fd4\u3057\u305f\u3089\u30af\u30ea\u30a2\uff01";Y["jp-jp"].levelStartHeader="\u30b4\u30fc\u30eb";Y["jp-jp"].TutorialText_1="\u8d64\u3068\u9ed2\u306e\u30ab\u30fc\u30c9\u3092\u4ea4\u4e92\u306b\u91cd\u306d\u3088\u3046";Y["jp-jp"].TutorialText_2="\u6570\u5b57\u304c\u5927\u304d\u3044\u9806\u306b\u9806\u756a\u306b\u91cd\u306d\u308b\u3088";Y["jp-jp"].TutorialText_3="\u30a8\u30fc\u30b9\u30ab\u30fc\u30c9\u306f\u53f3\u4e0a\u30bb\u30eb\u306b\u7f6e\u3044\u3066\u306d";
Y["jp-jp"].TutorialText_4="\u53f3\u4e0a\u30bb\u30eb\u306b\u306f\u3001\u7d75\u67c4\u30de\u30fc\u30af\u6bce\u306b \n\u30a8\u30fc\u30b9\u304b\u3089\u30ad\u30f3\u30b0\u306e\u9806\u306b\u7a4d\u307f\u4e0a\u3052\u3066\u306d";Y["jp-jp"].TutorialTitle_1="\u30ab\u30fc\u30c9\u306e\u8272";Y["jp-jp"].TutorialTitle_2="\u4e26\u3079\u65b9";Y["jp-jp"].TutorialTitle_3="\u30a8\u30fc\u30b9\u30ab\u30fc\u30c9\u306f\u53f3\u4e0a\u30bb\u30eb\u306b\u7f6e\u3044\u3066\u306d";Y["jp-jp"].TutorialTitle_4="\u30af\u30ea\u30a2\u65b9\u6cd5";
Y["jp-jp"].TutorialTitle_5="\u52dd\u3061\u65b9";Y["jp-jp"].optionsDifficulty_hard="\u4e0a\u7d1a";Y["jp-jp"].optionsDifficulty_medium="\u4e2d\u7d1a";Y["jp-jp"].optionsDifficulty_easy="\u521d\u7d1a";var bf=bf||{};bf.$h={Sj:"c28fe7f656634d823ab6483d02ecf09c",el:"4360442cc2162463fdc6a8d8cf329e32184e353b"};bf.ve=!1;var cf={};
function df(){cf={j:{Vy:"TinglySolitaire"},buttons:{default_color:"green",bigPlay:"blue"},Qb:{cm:.2},uf:{hy:[{s:"undefined"!==typeof s_screen_levelselect?s_screen_levelselect:void 0,x:0,y:0}],Hc:{O:X.O,align:"center",h:"middle",fillColor:"#004f5d",fontSize:Q({big:36,small:18})},ss:{O:X.O,fontSize:Q({big:34,small:18}),fillColor:"#004f5d",align:"center"},Yn:{O:X.O,fontSize:Q({big:34,small:18}),fillColor:"#004f5d",align:"center"}},lk:{Ik:-Rd.height,wp:{O:X.O,align:"center",h:"top",fontSize:Q({big:38,
small:19}),fillColor:"#001d5c"},xp:{align:"center"},yp:P(412,"round"),Ch:P(500),Xl:P(80),Kq:{O:X.O,fontSize:Q({big:46,small:23}),fillColor:"#000000",align:"center",h:"middle"},Mq:{align:"center"},Nq:P(370,"round")},ia:{Db:{align:"center"},Eb:P(2),Ik:"undefined"!==typeof s_overlay_endless?-s_overlay_endless.height:"undefined"!==typeof Wd?-Wd.height:"undefined"!==typeof s_overlay_level_win?-s_overlay_level_win.height:0,ui:[{type:"y",va:0,duration:800,end:P(14),Ma:gc,qj:!0}],Hk:[{type:"y",va:0,duration:600,
end:"undefined"!==typeof s_overlay_endless?-s_overlay_endless.height:"undefined"!==typeof Wd?-Wd.height:"undefined"!==typeof s_overlay_level_win?-s_overlay_level_win.height:0,Ma:bc,qj:!0}],Hc:{O:X.O,align:"center",h:"top",fontSize:Q({big:44,small:22}),fillColor:"#001d5c"},XA:!0,Cm:{O:X.O,align:"center",h:"top",fillColor:"#586386",fontSize:Q({big:36,small:18})},Th:{O:X.O,align:"center",h:"top",fillColor:"#001d5c",fontSize:Q({big:76,small:38})},Fi:{O:X.O,h:"bottom",fillColor:"#586386",fontSize:Q({big:34,
small:18})},Xc:P(4),Kf:{O:X.O,h:"bottom",fillColor:"#001d5c",fontSize:Q({big:30,small:15})},Es:{O:X.O,align:"center",h:"middle",fontSize:Q({big:72,small:36}),fillColor:"#01513d"}},options:{si:800,ti:gc,Fk:600,Gk:bc,Zk:{align:"center",h:"middle",fontSize:Q({big:30,small:15}),fillColor:"#001d5c"},Hc:{O:X.O,align:"center",h:"top",fontSize:Q({big:40,small:20}),fillColor:"#001d5c"},Ic:P(21),xl:{h:"middle",align:"center",fontSize:Q({big:26,small:13}),fillColor:"#004f5d"},yl:{align:"center",h:"top",fontSize:Q({big:36,
small:18}),fillColor:"#004f5d"}},Rj:{font:{O:X.O,align:"center",h:"middle",fontSize:Q({big:72,small:36}),fillColor:"#037564",stroke:!0,Ec:P(5,"round"),strokeColor:"#ffffff",Td:!0}}}}var ef={};function ff(){ef={$A:{alpha:1}}}O.k=O.k||{};O.k.Qu=function(){var a=O.fx;a?a():console.log("Something is wrong with Framework Init (TG.startFramework)")};O.k.Zj=function(){O.d.tc()};O.k.iz=function(){};O.k.ok=function(){};O.k.$j=function(){O.d.tc()};O.k.ez=function(){};O.k.dz=function(){};O.k.hz=function(){};
O.k.Yq=function(){};O.k.cv=function(){};O.k.Xq=function(){};O.k.fz=function(){};O.k.Su=function(){O.d.tc()};O.k.Tu=function(){O.d.tc()};O.k.wg=function(){O.d.tc()};O.k.Ru=function(){O.d.tc()};O.k.Eq=function(a,b){void 0===O.d.Od&&(O.d.Od=new gf(!0));return hf(a,b)};O.k.Ro=function(a){void 0===O.d.Od&&(O.d.Od=new gf(!0));return jf(a)};O.k.Sc=function(a){window.open(a)};O.k.di=function(){return[{f:bd,url:O.w.Tq}]};O.k.dv=function(){};O.bd=O.bd||{};O.bd.Zj=function(){O.d.Ri=!1};O.bd.ok=function(){};
O.bd.$j=function(){O.d.Ri=!1};O.bd.wg=function(){O.d.Ri=!1};function kf(a,b){for(var c in a.prototype)b.prototype[c]=a.prototype[c]}function lf(a,b,c,d){this.tl=this.og=a;this.fu=b;this.duration=1;this.Sp=d;this.je=c;this.uj=null;this.Sg=0}function mf(a,b){a.Sg+=b;a.Sg>a.duration&&a.uj&&(a.uj(),a.uj=null)}
lf.prototype.W=function(){if(this.Sg>=this.duration)return this.je(this.duration,this.og,this.tl-this.og,this.duration);var a=this.je(this.Sg,this.og,this.tl-this.og,this.duration);this.Sp&&(a=this.Sp(a));return a};function nf(a,b){a.og=a.W();a.tl=b;a.duration=a.fu;a.uj=void 0;a.Sg=0}O.tu=void 0!==O.environment?O.environment:"development";O.ay=void 0!==O.ga?O.ga:O.tu;"undefined"!==typeof O.mediaUrl?ha(O.mediaUrl):ha(O.size);O.St="backButton";O.tf="languageSet";O.ye="resizeEvent";
O.version={builder:"1.8.3.0","build-time":"12:40:46","build-date":"02-05-2020",audio:H.Wa?"web audio api":H.Oa?"html5 audio":"no audio"};O.my=new function(){this.ne=this.Cv=3;m.t.Lg&&(this.ne=3>m.La.Zd?1:4.4>m.La.Zd?2:3);m.La.hk&&(this.ne=7>m.La.Zd?2:3);m.La.Xo&&(this.ne=8>m.La.Zd?2:3);O.version.browser_name=m.name;O.version.browser_version=m.t.version;O.version.os_version=m.La.version;O.version.browser_grade=this.ne};O.a={};"function"===typeof Ye&&Ye();"function"===typeof af&&af();
"function"===typeof df&&df();"function"===typeof ff&&ff();O.a.q="undefined"!==typeof Xe?Xe:{};O.a.j="undefined"!==typeof $e?$e:{};O.a.P="undefined"!==typeof cf?cf:{};O.a.Wy="undefined"!==typeof ef?ef:{};O.Cg=window.publisherSettings;O.w="undefined"!==typeof game_configuration?game_configuration:{};"undefined"!==typeof Ze&&(O.w=Ze);if("undefined"!==typeof bf)for(var of in bf)O.w[of]=bf[of];
(function(){var a,b,c,d,g;O.l={};O.l.kp="undefined"!==typeof Y?Y:{};O.l.ab=void 0!==O.w.Md&&void 0!==O.w.Md.ij?O.w.Md.ij:O.a.q.Md.ij;g=[];for(b=0;b<O.l.ab.length;b++)g.push(O.l.ab[b]);if(O.w.vx)for(b=O.l.ab.length-1;0<=b;b--)0>O.w.vx.indexOf(O.l.ab[b])&&O.l.ab.splice(b,1);try{if(d=function(){var a,b,c,d,g;b={};if(a=window.location.search.substring(1))for(a=a.split("&"),d=0,g=a.length;d<g;d++)c=a[d].split("="),b[c[0]]=c[1];return b}(),d.lang)for(c=d.lang.toLowerCase().split("+"),b=O.l.ab.length-1;0<=
b;b--)0>c.indexOf(O.l.ab[b])&&O.l.ab.splice(b,1)}catch(h){}0===O.l.ab.length&&(0<g.length?O.l.ab=g:O.l.ab.push("en-us"));c=navigator.languages?navigator.languages:[navigator.language||navigator.userLanguage];for(b=0;b<c.length;b++)if("string"===typeof c[b]){g=c[b].toLowerCase();for(d=0;d<O.l.ab.length;d++)if(0<=O.l.ab[d].search(g)){a=O.l.ab[d];break}if(void 0!==a)break}void 0===a&&(a=void 0!==O.w.Md&&void 0!==O.w.Md.oe?O.w.Md.oe:O.a.q.Md.oe);O.l.Ll=0<=O.l.ab.indexOf(a)?a:O.l.ab[0];O.l.Yi=O.l.kp[O.l.Ll];
if(void 0!==O.a.q.Kb.language_toggle&&void 0!==O.a.q.Kb.language_toggle.T){a=O.a.q.Kb.language_toggle.T;c=[];for(b=0;b<a.length;b++)0<=O.l.ab.indexOf(a[b].id)&&c.push(a[b]);O.a.q.Kb.language_toggle.T=c}O.l.K=function(a,b){var c,d,g,h;if(void 0!==O.l.Yi&&void 0!==O.l.Yi[a]){c=O.l.Yi[a];if(d=c.match(/#touch{.*}\s*{.*}/g))for(h=0;h<d.length;h++)g=(g=m.ff.Ls||m.ff.Jr)?d[h].match(/{[^}]*}/g)[1]:d[h].match(/{[^}]*}/g)[0],g=g.substring(1,g.length-1),c=c.replace(d[h],g);return c}return b};O.l.fs=function(a){O.l.Ll=
a;O.l.Yi=O.l.kp[a];la(O.tf,a)};O.l.dn=function(){return O.l.Ll};O.l.Ku=function(){return O.l.ab};O.l.hv=function(a){return 0<=O.l.ab.indexOf(a)}})();O.ku={La:"",mw:"",Tz:"",um:""};O.b={};
O.b.createEvent=function(a,b){var c,d,g,h;d=b.detail||{};g=b.bubbles||!1;h=b.cancelable||!1;if("function"===typeof CustomEvent)c=new CustomEvent(a,{detail:d,bubbles:g,cancelable:h});else try{c=document.createEvent("CustomEvent"),c.initCustomEvent(a,g,h,d)}catch(k){c=document.createEvent("Event"),c.initEvent(a,g,h),c.data=d}return c};O.b.Ho=function(a){var b=Math.floor(a%6E4/1E3);return(0>a?"-":"")+Math.floor(a/6E4)+(10>b?":0":":")+b};
O.b.ki=function(a){function b(){}b.prototype=pf.prototype;a.prototype=new b};O.b.Pw=function(a,b,c,d,g,h){var k=!1,l=document.getElementById(a);l||(k=!0,l=document.createElement("canvas"),l.id=a);l.style.zIndex=b;l.style.top=c+"px";l.style.left=d+"px";l.width=g;l.height=h;k&&((a=document.getElementById("viewport"))?a.appendChild(l):document.body.appendChild(l));O.Cd.push(l);return l};
(function(){var a,b,c,d,g,h,k;O.fr=0;O.gr=0;O.dl=!1;O.Vx=m.t.Lg&&m.t.Zd&&4<=m.t.Zd;O.Si=!1;O.pt=m.ff.Ls||m.ff.Jr;O.orientation=0<=ba.indexOf("landscape")?"landscape":"portrait";k="landscape"===O.orientation?O.a.q.lm:O.a.q.Cd;h="landscape"===O.orientation?O.a.j.lm:O.a.j.Cd;if(void 0!==h){if(void 0!==h.Lc)for(a in h.Lc)k.Lc[a]=h.Lc[a];if(void 0!==h.rc)for(a in h.rc)k.rc[a]=h.rc[a]}b=function(){var a,b,c,d;if(O.Vx&&!O.Si){O.Si=!0;if(a=document.getElementsByTagName("canvas"))for(b=0;b<a.length;b++)if(c=
a[b],!c.getContext||!c.getContext("2d")){O.Si=!1;return}b=document.createEvent("Event");b.Yz=[!1];b.initEvent("gameSetPause",!1,!1);window.dispatchEvent(b);d=[];for(b=0;b<a.length;b++){c=a[b];var g=c.getContext("2d");try{var h=g.getImageData(0,0,c.width,c.height);d.push(h)}catch(k){}g.clearRect(0,0,c.width,c.height);c.style.visibility="hidden"}setTimeout(function(){for(var b=0;b<a.length;b++)a[b].style.visibility="visible"},1);setTimeout(function(){for(var b=0;b<a.length;b++){var c=a[b].getContext("2d");
try{c.putImageData(d[b],0,0)}catch(g){}}b=document.createEvent("Event");b.initEvent("gameResume",!1,!1);window.dispatchEvent(b);O.Si=!1},100)}};c=function(){var a,c,d,g,h,A,r,s,t;"landscape"===O.orientation?(a=[window.innerWidth,window.innerHeight],c=[k.ng,k.uc],d=k.minWidth):(a=[window.innerHeight,window.innerWidth],c=[k.uc,k.Mb],d=k.minHeight);g=c[0]/c[1];h=a[0]/a[1];A=d/c[1];h<g?(h=h<A?Math.floor(a[0]/A):a[1],g=a[0]):(h=a[1],g=Math.floor(a[1]*g));r=h/c[1];!O.pt&&1<r&&(g=Math.min(a[0],c[0]),h=Math.min(a[1],
c[1]),r=1);a="landscape"===O.orientation?g:h;c="landscape"===O.orientation?h:g;t=s=0;window.innerHeight<Math.floor(k.uc*r)&&(s=Math.max(k.wk,window.innerHeight-Math.floor(k.uc*r)));window.innerWidth<Math.floor(k.Mb*r)&&(t=Math.floor(Math.max(k.ng-k.Mb,(window.innerWidth-Math.floor(k.Mb*r))/r)),window.innerWidth<Math.floor(k.Mb*r)+t*r&&(t+=Math.floor(Math.max((d-k.ng)/2,(window.innerWidth-(k.Mb*r+t*r))/2/r))));O.Dp=k.uc-k.$p;O.Wt=k.Mb-k.ng;O.ea=s;O.ry=t;O.qy=Math.min(O.Wt,-1*O.sy);O.me=(k.rc.top||
k.cf)-O.ea;O.X={top:-1*s,left:-1*t,height:Math.min(k.uc,Math.round(Math.min(c,window.innerHeight)/r)),width:Math.min(k.Mb,Math.round(Math.min(a,window.innerWidth)/r))};O.pA="landscape"===O.orientation?{top:0,left:Math.floor((k.ng-k.minWidth)/2),width:k.minWidth,height:k.minHeight}:{top:Math.abs(k.wk),left:k.bf,width:k.Mb,height:k.minHeight};d=Math.min(window.innerHeight,c);a=Math.min(window.innerWidth,a);"landscape"===O.orientation?document.getElementById("viewport").setAttribute("style","position:fixed; overflow:hidden; z-index: 0; width:"+
a+"px; left:50%; margin-left:"+-a/2+"px; height: "+d+"px; top:50%; margin-top:"+-d/2+"px"):document.getElementById("viewport").setAttribute("style","position:absolute; overflow:hidden; z-index: 0; width:"+a+"px; left:50%; margin-left:"+-a/2+"px; height: "+d+"px");d=function(a,b,c,d){var g,h,l,n;g=void 0!==b.top?b.top:k.cf;h=void 0!==b.left?b.left:k.bf;l=void 0!==b.width?b.width:k.Mb;n=void 0!==b.height?b.height:k.uc;a.Hy=Math.floor(r*g);a.Gy=Math.floor(r*h);a.Iy=Math.floor(r*l);a.Fy=Math.floor(r*
n);!1!==c&&(g+=s);!1!==d&&(h+=t);a.setAttribute("style","position:absolute; left:"+Math.floor(r*h)+"px; top:"+Math.floor(r*g)+"px; width:"+Math.floor(r*l)+"px; height:"+Math.floor(r*n)+"px; z-index: "+b.depth)};d(O.am,k.km);d(O.Qm,k.Lc);d(O.$m,k.rc,!1,!0);d(O.Nd,k.Ye);b();setTimeout(b,5E3);setTimeout(b,1E4);setTimeout(b,2E4);la(O.ye)};a=function(){if(O.fr===window.innerHeight&&O.gr===window.innerWidth||O.dl)return!1;document.documentElement.style["min-height"]=5E3;d=window.innerHeight;g=40;O.dl=window.setInterval(function(){document.documentElement.style.minHeight=
"";document.documentElement.style["min-height"]="";window.scrollTo(0,m.t.Lg?1:0);g--;if((m.t.Lg?0:window.innerHeight>d)||0>g)O.gr=window.innerWidth,O.fr=window.innerHeight,clearInterval(O.dl),O.dl=!1,document.documentElement.style["min-height"]=window.innerHeight+"px",document.getElementById("viewport").style.height=window.innerHeight+"px",c()},10)};O.nf=k.Lc.left||k.bf;O.of=k.Lc.top||k.cf;O.Ju=k.Lc.width||k.Mb;O.Cu=k.Lc.height||k.uc;O.pf=k.rc.left||k.bf;O.me=k.rc.top||k.cf;O.Yy=k.rc.width||k.Mb;
O.Xy=k.rc.height||k.uc;O.yv=k.Ye.left||k.bf;O.zv=k.Ye.top||k.cf;O.Av=k.Ye.width||k.Mb;O.xv=k.Ye.height||k.uc;h=function(a){return O.b.Pw(a.id,a.depth,void 0!==a.top?a.top:k.cf,void 0!==a.left?a.left:k.bf,void 0!==a.width?a.width:k.Mb,void 0!==a.height?a.height:k.uc)};O.Cd=[];O.am=h(k.km);O.Qm=h(k.Lc);O.$m=h(k.rc);O.Nd=h(k.Ye);c();document.body.addEventListener("touchmove",function(){},!0);document.body.addEventListener("touchstart",a,!0);window.addEventListener("resize",a,!0);window.setInterval(a,
200);O.gc={};O.gc[O.mf]=O.am;O.gc[O.zq]=O.Qm;O.gc[O.Wj]=O.$m;O.gc[O.qg]=O.Nd;O.gc[O.lf]=O.am;O.gc[O.Xb]=O.Nd;O.gc[O.Jd]=O.Nd})();
O.b.Mt=function(){var a,b;if(b=document.getElementById("viewport"))a=document.createElement("img"),a.className="banner",a.src=ia.be+"/media/banner_game_640x100.png",a.style.position="absolute",a.style.bottom="0px",a.style.width="100%",a.style.zIndex=300,b.appendChild(a),O.Yt=!0,O.Eh=!0,b=function(a){O.Yt&&O.Eh&&(O.k.Sc("http://www.tinglygames.com/html5-games/"),a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},a.addEventListener("mouseup",b,!0),a.addEventListener("touchend",
b,!0),a.addEventListener("mousedown",function(a){O.Eh&&(a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},!0),a.addEventListener("touchstart",function(a){O.Eh&&(a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},!0)};O.b.IA=function(){var a,b=document.getElementsByClassName("banner");if(b){for(a=0;a<b.length;a++)b[a].style.display="inline";O.Eh=!0}};
O.b.cz=function(){var a,b=document.getElementsByClassName("banner");if(b){for(a=0;a<b.length;a++)b[a].style.display="none";O.Eh=!1}};O.b.cn=function(a){return a===O.Qm?{x:O.nf,y:O.of}:a===O.$m?{x:O.pf,y:O.me}:{x:O.yv,y:O.zv}};O.b.qf=function(a){return O.gc[a]};O.b.mb=function(a){return O.gc[a]?(w.canvas!==O.gc[a]&&w.mb(O.gc[a]),!0):!1};O.b.Za=function(a,b){if(O.gc[b]){var c=I;a.ya!==b&&(c.qh=!0);a.ya=b;a.canvas=O.gc[b]}};
O.b.g=function(a,b,c,d){var g;b=b||0;c=c||0;d=d||0;if("number"===typeof a)return a;if("object"===typeof a)switch(g=a.offset||0,a.align){case "center":return Math.round(b/2-(c/2-d))+g;case "left":case "top":return g-d;case "right":case "bottom":return b-c-g-d;default:return g+0}return 0};
O.b.qa=function(a,b,c,d){var g;b=b||0;c=c||0;if("number"===typeof a)return a;if("object"===typeof a)switch(g=a.offset||0,a.align){case "center":return"center"===d||"middle"===d?Math.round(b/2)+g:"left"===d||"top"===d?Math.round(b/2-c/2)+g:Math.round(b/2+c/2)-g;case "left":case "top":return"center"===d||"middle"===d?Math.round(c/2)+g:"left"===d||"top"===d?g:c+g;case "right":case "bottom":return"center"===d||"middle"===d?b-Math.round(c/2)-g:"left"===d||"top"===d?b-Math.round(c/2)-g:b-g;default:return g+
0}return 0};O.b.zy=function(a,b,c,d){switch(d){case "center":case "middle":return Math.round(b/2)+a;case "left":case "top":return a;case "right":case "bottom":return c+a}return 0};O.ba=O.ba||{};O.ba.Sw=!1;O.ba.$q=function(a){a instanceof Array&&(this.Sj=a[0],this.el=a[1],this.Zt="https://api.gameanalytics.com/v2/"+this.Sj,this.ar=!0)};
O.ba.Pe=function(a,b){var c,d=JSON.stringify(b),g=window.Crypto.HmacSHA256(d,this.el),g=window.Crypto.enc.Base64.stringify(g),h=this.Zt+"/"+a;try{c=new XMLHttpRequest,c.open("POST",h,!0),this.Sw&&(c.onreadystatechange=function(){4===c.readyState&&(200===c.status?(console.log("GOOD! statusText: "+c.statusText),console.log(b)):console.log("ERROR ajax call error: "+c.statusText+", url: "+h))}),c.setRequestHeader("Content-Type","text/plain"),c.setRequestHeader("Authorization",g),c.send(d)}catch(k){}};
O.ba.$b={ep:"user",dp:"session_end",yt:"business",zt:"resource",Ti:"progression",Fl:"design",ERROR:"error"};O.ba.Le=function(){return{user_id:this.Vo,session_id:this.Nw,build:this.bu,device:this.um,platform:this.platform,os_version:this.nw,sdk_version:"rest api v2",v:2,client_ts:Math.floor(Date.now()/1E3),manufacturer:"",session_num:1}};
O.ba.cb=function(a,b,c,d,g,h,k){this.Nw=a;h&&"object"===typeof h&&(this.Vo=h.Vo);this.bu=g;this.i=!0;this.ar&&(this.um=k.um,this.platform=k.La,this.nw=k.mw);this.Pe("init",this.Le())};O.ba.kx=function(a){var b=this.Le(),c=[];b.category=a;c.push(b);this.Pe("events",c)};O.ba.Fm=function(a,b,c,d){a=[];b=this.Le();b.length=Math.floor(c);b.category=d;a.push(b);this.Pe("events",a)};
O.ba.Sa=function(a,b,c,d){var g=[],h=!1;if(this.i&&this.ar){if(d)switch(d){case O.ba.$b.ep:this.kx(d);h=!0;break;case O.ba.$b.dp:this.Fm(0,0,c,d);h=!0;break;case O.ba.$b.yt:h=!0;break;case O.ba.$b.zt:h=!0;break;case O.ba.$b.Ti:this.wu(a,b,c,d);h=!0;break;case O.ba.$b.Fl:this.uu(a,b,c,d),h=!0}h||(d="",b&&(d=b instanceof Array?b.toString().replace(",",":"):d+b),b=this.Le(),b.event_id=d+":"+a,b.value=c,g.push(b),this.Pe("design",g))}};O.ba.oA=function(a,b,c){this.Sa(a,b,c)};O.ba.Sy=function(){};
O.ba.Ty=function(){};O.ba.wu=function(a,b,c,d){var g=[],h=this.Le();switch(a){case "Start:":h.category=d;h.event_id=a+b;break;case "Complete:":h.category=d;h.event_id=a+b;h.score=c;break;case "Fail:":h.category=d,h.event_id=a+b,h.score=c}g.push(h);this.Pe("events",g)};O.ba.uu=function(a,b,c,d){var g=[],h=this.Le();h.category=d;h.event_id=a+b;h.value=c;g.push(h);this.Pe("events",g)};O.ba.as=function(a,b){var c=[],d=this.Le();d.category="error";d.message=a;d.severity=b;c.push(d);this.Pe("events",c)};
function qf(){this.ya=this.depth=0;this.visible=!1;this.i=!0;this.a=O.a.q.Ba;this.ww=this.a.Fx;J(this);Mb(this,"system")}function rf(){var a=sf("userId","");""===a&&(a=tf(),uf("userId",a));return a}function tf(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(a){var b=16*Math.random()|0;return("x"===a?b:b&3|8).toString(16)})}e=qf.prototype;e.start=function(a){O.ba.$q(a);O.ba.cb(tf(),O.a.j.kf.Sm,O.a.P.id,O.w.xw,vf(),{Vo:rf()},O.ku)};e.Sa=function(a,b,c,d){O.ba.Sa(a,b,c,d)};
function wf(a,b,c,d){var g,h;for(g=0;g<a.Z.length;g++)void 0!==a.Z[g]&&a.Z[g].tag===b&&(h=a.Z[g],a.Sa(c,d,h.r/1E3,O.ba.$b.dp),h.i=!1)}function xf(){var a=O.Ba,b=O.d.Sf,c;for(c=0;c<a.Z.length;c++)void 0!==a.Z[c]&&a.Z[c].tag===b&&(a.Z[c].paused+=1)}e.as=function(a,b){O.ba.as(a,b)};e.ec=function(){this.Z=[]};
e.wa=function(a){var b,c=0;for(b=0;b<this.Z.length;b++)this.Z[b].i&&(0===this.Z[b].paused&&(this.Z[b].r+=a),c=b);c<this.Z.length-1&&(a=this.Z.length-Math.max(this.ww,c+1),0<a&&this.Z.splice(this.Z.length-a,a))};
function gf(a,b,c){this.zr=a||!1;this.host=b||"http://localhost:8080";this.Mw=c||this.host+"/services/storage/gamestate";this.Is="undefined"!==typeof window.localStorage;this.tn=this.To=!1;var d=this;window.parent!==window&&(m.t.ko||m.La.hk)&&(window.addEventListener("message",function(a){a=a.data;var b=a.command;"init"===b?d.To="ok"===a.result:"getItem"===b&&d.Xj&&("ok"===a.result?d.Xj(a.value):d.Xj(a.defaultValue))},!1),this.Xj=null,window.parent.postMessage({command:"init"},"*"));this.ri=[];window.setTimeout(function(){d.tn=
!0;for(var a=0;a<d.ri.length;++a)d.ri[a]();d.ri=[]},2E3)}function yf(){return"string"===typeof O.w.Bs&&""!==O.w.Bs?O.w.Bs:void 0!==O.a.j.kf&&void 0!==O.a.j.kf.Sm?O.a.j.kf.Sm:"0"}function hf(a,b){var c=O.d.Od;"function"===typeof b&&(c.tn?zf(c,a,b):c.ri.push(function(){zf(c,a,b)}))}function jf(a){var b=O.d.Od;b.tn?Af(b,a):b.ri.push(function(){Af(b,a)})}
function Af(a,b){var c=null,d=yf();try{c=JSON.stringify({lastChanged:new Date,gameState:JSON.stringify(b)})}catch(g){}if(a.To)window.parent.postMessage({command:"setItem",key:"TG_"+d,value:c},"*");else{if(a.Is)try{window.localStorage.setItem(d,c)}catch(h){}a.zr||(c=new nb("gameState_"+d),c.text=void 0===JSON?"":JSON.stringify(b),ob(c,a.Mw+"/my_ip/"+d))}}
function zf(a,b,c){var d=null,g=null,h=yf();if(a.To)a.Xj=function(a){var g;try{d=JSON.parse(a),g=JSON.parse(d.gameState)}catch(h){g=b}c(g)},window.parent.postMessage({command:"getItem",key:"TG_"+h},"*");else{if(a.Is)try{(d=window.localStorage.getItem(h))&&(d=JSON.parse(d))}catch(k){c(b);return}a.zr||(a=new nb("gameState_"+h),g=null,pb(a,gf.mA+"/my_ip/"+h)&&(g=void 0===JSON?{}:JSON.parse(a.text)));try{if(d){if(g&&Date.parse(g.lastChanged)>Date.parse(d.lastChanged)){c(JSON.parse(g.gameState));return}c(JSON.parse(d.gameState));
return}if(g){c(JSON.parse(g.gameState));return}}catch(l){c(b);return}c(b)}}
function Bf(a,b,c){console&&console.log&&console.log("Hosted on: "+(window.location.origin?window.location.origin:window.location.protocol+"//"+window.location.hostname));this.depth=1E3;this.yc=this.visible=!1!==c;this.i=!0;O.b.Za(this,O.Xb);var d;this.a=O.a.q.Rc;if("landscape"===O.orientation&&O.a.q.zn)for(d in O.a.q.zn)this.a[d]=O.a.q.zn[d];for(d in O.a.P.Rc)this.a[d]=O.a.P.Rc[d];if(O.w.Rc)for(d in O.w.Rc)this.a[d]=O.w.Rc[d];this.Lb=a;this.Pp=b;this.dq=!1;this.Dh=0;this.bm=!1;this.lj=0;this.kj=
this.a.Vt;this.bo=!0;this.tv=.6/Math.log(this.a.qk+1);this.vt=void 0!==O.w.sv?O.w.sv:this.a.Wv;this.Dv=this.vt+this.a.Gv;J(this)}e=Bf.prototype;e.oo=function(a){var b;O.b.mb(O.lf);pa(0,0,this.canvas.width,this.canvas.height,"white",!1);b=U.M();(O.w.Rc&&O.w.Rc.Ii||this.a.Ii)&&C(b,O.w.Rc&&O.w.Rc.Ii?O.w.Rc.Ii:this.a.Ii);a=O.l.K(a,"<"+a.toUpperCase()+">");b.u(a,this.canvas.width/2,this.canvas.height/2,this.a.ql);this.error=!0;this.visible=this.yc=!1;this.canvas.$=!0};
e.Pd=function(){this.ja&&(this.vb=O.b.g(this.a.vb,O.X.width,this.ja.width)+O.X.left,this.ic=O.b.g(this.a.ic,O.X.height,this.ja.height)+O.X.top)};
e.sm=function(){var a,b,c,d,g,h;if("function"===typeof O.k.di&&(h=this.a.zf,(this.za=O.k.di())&&0<this.za.length)){this.ja?this.ja.clear():this.ja=new y(this.a.zf,this.a.pi);z(this.ja);h/=this.za.length;for(c=0;c<this.za.length;c++)try{g=this.za[c].f,d=Math.min(1,Math.min((h-20)/g.width,this.a.pi/g.height)),a="center"===this.a.ni?h*c+Math.round((h-g.width*d)/2):h*c+Math.round(h-g.width*d)-10,b=this.ja.height-g.height*d,g instanceof x?g.oa(0,a,b,d,d,0,1):w.context.drawImage(g,a,b,g.width*d,g.height*
d)}catch(k){}B(this.ja);this.pk=0;this.Bn=!0;this.oi=0;this.yf=Sb(0,0,this.ja.width,this.ja.height);this.Pd()}};
e.Fa=function(){var a,b,c,d;this.bo?w.clear():O.b.mb(O.lf);if(this.a.backgroundImage)if(d=this.a.backgroundImage,a=Math.abs(O.ea),1<d.L){c=(w.canvas.height-a)/d.lg;b=-(d.Lh*c-w.canvas.width)/2;c=w.context;var g=c.globalAlpha,h,k,l;c.globalAlpha=this.Dh;for(h=0;h<d.L;h+=1)k=b+h%d.Bg*d.width,l=a+d.height*Math.floor(h/d.Bg),d.He.ra(d.Ce[h],d.De[h],d.Ee[h],d.Vd[h],d.Ud[h],k-d.zb+d.Wd[h],l-d.Ab+d.Xd[h]);c.globalAlpha=g}else c=(this.canvas.height-a)/d.height,b=-Math.floor((d.width*c-this.canvas.width)/
2),d instanceof x?d.oa(0,b,a,c,c,0,this.Dh):d instanceof y&&d.oa(b,a,c,c,0,this.Dh);d=this.a.re+this.a.xn+this.a.xg;b=pc.height;a=pc.width-(this.a.re+this.a.xn);this.yg=O.b.g(this.a.yg,w.canvas.width,d);this.xf=O.b.g(this.a.xf,w.canvas.height,b);pc.ra(0,0,0,this.a.re,b,this.yg,this.xf,1);pc.Ej(0,this.a.re,0,a,b,this.yg+this.a.re,this.xf,this.a.xg,b,1);pc.ra(0,this.a.re+a,0,this.a.xn,b,this.yg+this.a.re+this.a.xg,this.xf,1)};
function Cf(a){a.bo&&(a.bm=!0);a.visible&&(a.Fa(),a.sm(),"function"===typeof O.k.en&&(a.Sd=O.k.en(),a.Sd instanceof y&&(a.Hg=!0,a.ms=Math.floor((a.canvas.width-a.Sd.width)/2),a.ns=Math.floor((a.canvas.height-a.Sd.height)/2))));O.d.nk&&ia.td("audio");O.d.mk&&ia.td("audio_music");ia.td("fonts")}
e.ec=function(){var a,b=!1;if(void 0!==O.w.Ci)if(!1===O.w.Ci.uv)b=!0;else{if(void 0!==O.w.Ci.xm)for(a=0;a<O.w.Ci.xm.length;a++){var c;a:{c=O.w.Ci.xm[a];var d=void 0,g=void 0,h=d=void 0,g=void 0,g=window.location.origin?window.location.origin:window.location.protocol+"//"+window.location.hostname;if(0===g.indexOf("file://")&&c===Df("file://"))c=!0;else{g=g.split(".");d=g.shift().split("://");d[0]+="://";g=d.concat(g);h="";for(d=g.length-1;0<=d;d--)if(h=g[d]+(0<d&&d<g.length-1?".":"")+h,Df(h)===c){c=
!0;break a}c=!1}}if(c){b=!0;break}}}else b=!0;b&&"number"===typeof O.w.Ex&&(new Date).getTime()>O.w.Ex&&(b=!1);b?(this.ig=[],this.error=!1,this.Vs=this.Mm=this.hj=this.r=0,this.ready=this.Hg=!1,this.qv=void 0!==this.a.xr?this.a.xr:this.a.re-this.a.mi,this.rv=void 0!==this.a.yr?this.a.yr:Math.floor((pc.height-ee.height)/2),this.yn=ee.width-(this.a.mi+this.a.wr),this.Lm=this.Lr=this.zp=!1,(this.Ei=ia.complete("start"))&&Cf(this),this.vr=ia.complete("load"),this.visible&&(this.Ws=document.getElementById("throbber_image"),
this.Yd=this.a.Yd,this.Fo=O.b.g(this.a.Fo,this.canvas.width,this.Yd),this.rl=O.b.g(this.a.rl,this.canvas.height,this.Yd))):I.pause()};
e.wa=function(a){this.r+=a;"function"===typeof O.k.en&&void 0===this.Sd&&(this.Sd=O.k.en(),this.Sd instanceof y&&(this.Hg=!0,this.ms=Math.floor((this.canvas.width-this.Sd.width)/2),this.ns=Math.floor((this.canvas.height-this.Sd.height)/2)));this.Hg&&0<=this.a.os&&this.r>=this.a.os&&(this.Hg=!1);this.bm&&(this.lj+=a,this.lj>=this.kj?(this.bm=!1,this.Dh=1):this.Dh=bc(this.lj,0,1,this.kj));this.Ei&&(this.hj+=a,this.Mm+=a);this.Vs=Math.round(this.r/this.a.Cx%(this.a.Dx-1));this.Bn&&(this.pk=0+this.oi/
this.a.An*1,this.oi+=a,this.oi>=this.a.An&&(this.Bn=!1,this.pk=1));"function"===typeof this.Pp&&this.Pp(Math.round((ja("load")+ja("audio")+ja("audio_music"))/2));!this.ready&&this.vr&&(this.Lm||this.Mm>=this.a.qk)&&(!O.d.nk||this.zp||H.Oa&&this.hj>=this.a.qk)&&(!O.d.mk||this.Lr||H.Oa&&this.hj>=this.a.qk)&&(this.ready=!0);if(a=!this.dq&&!this.error&&this.ready&&this.r>=this.vt)a=O.d,a=(a.Mc&&a.Bb&&!a.Bb.fv()?!1:!0)||this.r>=this.Dv;a&&(this.dq=!0,this.Lb())};
e.sg=function(a,b,c){!this.Hg&&this.yf&&Ub(this.yf,this.vb,this.ic,b,c)&&(this.eb=Math.floor((b-this.vb)/(this.ja.width/this.za.length)))};e.ug=function(a,b,c){void 0!==this.eb&&(this.za[this.eb].url||this.za[this.eb].action)&&Ub(this.yf,this.vb,this.ic,b,c)&&(b-=this.vb,b>=this.ja.width/this.za.length*this.eb&&b<this.ja.width/this.za.length*(this.eb+1)&&(this.za[this.eb].url?O.k.Sc(this.za[this.eb].url):this.za[this.eb].action()));this.eb=void 0};
e.Qc=function(a,b){"Load Complete"===a&&"start"===b.Va?(this.Ei=!0,Cf(this)):"Load Complete"===a&&"load"===b.Va?this.vr=!0:"Load Complete"===a&&"audio"===b.Va?this.zp=!0:"Load Complete"===a&&"audio_music"===b.Va?this.Lr=!0:"Load Complete"===a&&"fonts"===b.Va&&(this.Lm=!0);a===O.ye&&this.Pd()};
e.bb=function(){if(!this.error){this.bo&&this.Ei?this.Fa():w.clear();try{this.Ws&&w.context.drawImage(this.Ws,this.Yd*this.Vs,0,this.Yd,this.Yd,this.Fo,this.rl,this.Yd,this.Yd)}catch(a){}if(this.Ei){var b=0,c=this.yg+this.qv,d=this.xf+this.rv,g=ee.height;ee.ra(0,b,0,this.a.mi,g,c,d,1);b+=this.a.mi;c+=this.a.mi;this.ready?(ee.Ej(0,b,0,this.yn,g,c,d,this.a.xg,g,1),b+=this.yn,c+=this.a.xg,ee.ra(0,b,0,this.a.wr,g,c,d,1)):ee.Ej(0,b,0,this.yn,g,c,d,Math.floor(Math.min((ja("load")+ja("audio"))/500+this.tv*
Math.log(this.r+1),1)*this.a.xg),g,1);this.ja&&this.ja.ed(this.vb,this.ic,this.pk)}this.Hg&&this.Sd.u(this.ms,this.ns)}};
function Ef(){var a,b;b=this;this.depth=100;this.i=this.visible=!0;O.b.Za(this,O.Xb);this.a=O.a.q.wo;if("landscape"===O.orientation&&O.a.q.xo)for(a in O.a.q.xo)this.a[a]=O.a.q.xo[a];this.Kb=O.a.q.Kb;if("landscape"===O.orientation&&O.a.q.jm)for(a in O.a.q.jm)this.Kb[a]=O.a.q.jm[a];for(a in O.a.P.wo)this.a[a]=O.a.P.wo[a];this.ig=[];a=Ff(O.d);this.Rp=void 0!==a&&null!==a;this.Ja=new Vb;this.Ja.ua(this.a.Du,function(){b.ws.call(b)});this.Ja.ua(this.a.Nr,function(){b.ys.call(b)});this.Ja.ua(O.n.hl&&!this.Rp?
this.a.sw:this.a.Nr,function(){b.zs.call(b)});this.Ja.ua(this.a.Sv,function(){b.xs.call(b)});J(this,!1)}e=Ef.prototype;e.ws=function(){this.Uj=!0;this.a.rg&&(this.bi=O.b.g(this.a.bi,this.canvas.width,Yd.width),this.Tj=O.b.g(this.a.Tj,this.canvas.width,Yd.width),this.ci=O.b.g(this.a.ci,this.canvas.height,Yd.height),this.ai=O.b.g(this.a.ai,this.canvas.height,Yd.height),this.Zm=this.bi,this.Vj=this.ci,this.Um=this.a.Xm,this.Vm=this.a.Ym,this.Tm=this.a.Wm,this.dc=0,this.Pd())};
e.ys=function(a){function b(a,b,c,d){return ec(a,b,c,d,15)}var c,d;O.n.hl&&!this.Rp&&(c=O.b.g(this.a.cq,this.canvas.width,this.a.Sh,Math.floor(this.a.Sh/2)),d=O.b.g(this.a.Cj,this.canvas.height,Kd.height,Math.floor(Kd.height/2)),c=new Gf("difficulty_toggle",c,d,this.depth-20,Hf()+"",this.a.Sh,{U:function(a){If(parseInt(a,10));return!0},Pb:!0}),c.Tc=Math.floor(this.a.Sh/2),c.Uc=Math.floor(Kd.height/2),!1!==a&&(Jf(c,"xScale",b,0,1,this.a.bq),Jf(c,"yScale",b,0,1,this.a.bq)),this.Bj=c,this.Cj=c.y,this.ig.push(c),
this.Pd())};
e.zs=function(a){function b(a,b,c,d){return ec(a,b,c,d,15)}var c,d=this;this.Xn=!0;c=new Kf("bigPlay",O.b.g(this.a.rw,this.canvas.width,this.a.xi,Math.floor(this.a.xi/2)),O.b.g(this.a.Uk,this.canvas.height,Vd.height,Math.floor(Vd.height/2)),this.depth-20,"startScreenPlay",this.a.xi,{U:function(){K(I,d);var a=O.d,b,c,l;void 0===O.d.Qb&&(void 0!==O.a.P.Qb&&(void 0!==O.a.P.Qb.Xt&&(b=O.a.P.Qb.Xt),void 0!==O.a.P.Qb.cm&&(H.sd("music",O.a.P.Qb.cm),a.ve()||jb("music"),O.d.ew=O.a.P.Qb.cm),c=void 0!==O.a.P.Qb.Ut?
O.a.P.Qb.Ut:0,l=void 0!==O.a.P.Qb.kj?O.a.P.Qb.kj:0),void 0===b&&"undefined"!==typeof a_music&&(b=a_music),void 0!==b&&(O.d.Qb=H.play(b,c,l),O.d.Qb&&(H.tp(O.d.Qb,"music"),H.fl(O.d.Qb,!0))));O.n.Fg&&!a.Mc?a.screen=new Lf:Mf(a,0);return!0},Pb:!0});c.Tc=Math.floor(this.a.xi/2);c.Uc=Math.floor(Vd.height/2);!1!==a?(Jf(c,"xScale",b,0,1,this.a.Sk),Jf(c,"yScale",b,0,1,this.a.Sk),this.Tk=0):this.Tk=this.a.Sk;this.Rk=c;this.Uk=c.y;this.ig.push(c);this.Pd()};
function Nf(a){var b=ic([gc,function(a,b,g,h){return ec(a,b,g,h,2)},Yb],[!0,!1,!1],[.02,.1,.88]);a.Vr=!0;Jf(a.Rk,"xScale",hc(b),1,.25,4E3);Jf(a.Rk,"yScale",hc(b),1,-.1,4E3)}e.xs=function(a){var b;this.Hr=!0;b=new pf(O.b.g(this.a.Jn,this.canvas.width,Hd.width),O.b.g(this.a.vk,this.canvas.height,Hd.height),this.depth-20,new Tb(Hd),[Hd],{U:O.d.Rd,Pb:!0});!1!==a&&Jf(b,"alpha",M,0,1,this.a.Rv);this.In=b;this.vk=b.y;this.ig.push(b);this.Pd()};
e.Fa=function(){var a,b,c,d;if(a=this.a.backgroundImage)O.b.mb(O.lf),c=Math.abs(O.ea),1<a.L?(b=(w.canvas.height-c)/a.lg,d=-(a.Lh*b-w.canvas.width)/2,ta(a,d,c)):(b=(w.canvas.height-c)/a.height,d=-Math.floor((a.width*b-this.canvas.width)/2),a.oa(0,d,c,b,b,0,1))};
e.sm=function(){var a,b,c,d,g,h;if("function"===typeof O.k.di&&(h=this.a.zf,(this.za=O.k.di())&&0<this.za.length)){this.ja?this.ja.clear():this.ja=new y(this.a.zf,this.a.pi);z(this.ja);h/=this.za.length;for(c in this.za)try{g=this.za[c].f,d=Math.min(1,Math.min((h-20)/g.width,this.a.pi/g.height)),a="center"===this.a.ni?h*c+Math.round((h-g.width*d)/2):h*c+Math.round(h-g.width*d)-10,b=this.ja.height-g.height*d,g instanceof x?g.oa(0,a,b,d,d,0,1):w.context.drawImage(g,a,b,g.width*d,g.height*d)}catch(k){}B(this.ja);
this.pk=0;this.Bn=!0;this.oi=0;this.yf=Sb(0,0,this.ja.width,this.ja.height);this.Pd()}};e.Pd=function(){var a;a=0;O.X.height<this.a.hm&&(a=this.a.hm-O.X.height);this.Xn&&(this.Rk.y=this.Uk-a);this.Hr&&(this.In.y=this.vk-a,this.In.x=O.b.g(this.a.Jn,O.X.width,Hd.width)+O.X.left);this.Bj&&(this.Bj.y=this.Cj-a);this.Uj&&this.dc>=this.a.Pc&&(this.Vj=this.ai-O.ea);this.ja&&(this.vb=O.b.g(this.a.vb,O.X.width,this.ja.width)+O.X.left,this.ic=O.b.g(this.a.ic,O.X.height,this.ja.height)+O.X.top)};
e.ec=function(){this.Fa();this.a.rg&&(O.b.mb(O.Xb),this.a.rg.u(0,0,-this.a.rg.height-10));this.sm();this.Ja.start()};e.Yb=function(){var a;for(a=0;a<this.ig.length;a++)K(I,this.ig[a])};
e.wa=function(a){this.canvas.$=!0;this.Uj&&this.dc<this.a.Pc&&(this.Zm=this.a.Hu(this.dc,this.bi,this.Tj-this.bi,this.a.Pc),this.Vj=this.a.Iu(this.dc,this.ci,this.ai-this.ci,this.a.Pc)-O.ea,this.Um=this.a.Fu(this.dc,this.a.Xm,this.a.Bq-this.a.Xm,this.a.Pc),this.Vm=this.a.Gu(this.dc,this.a.Ym,this.a.Cq-this.a.Ym,this.a.Pc),this.Tm=this.a.Eu(this.dc,this.a.Wm,this.a.Aq-this.a.Wm,this.a.Pc),this.dc+=a,this.dc>=this.a.Pc&&(this.Zm=this.Tj,this.Vj=this.ai-O.ea,this.Um=this.a.Bq,this.Vm=this.a.Cq,this.Tm=
this.a.Aq));this.Xn&&(!this.Vr&&this.Tk>=this.a.Sk+this.a.qw&&Nf(this),this.Tk+=a)};e.sg=function(a,b,c){this.yf&&Ub(this.yf,this.vb,this.ic,b,c)&&(this.eb=Math.floor((b-this.vb)/(this.ja.width/this.za.length)))};
e.ug=function(a,b,c){void 0!==this.eb&&(this.za[this.eb].url||this.za[this.eb].action)&&Ub(this.yf,this.vb,this.ic,b,c)&&(b-=this.vb,b>=this.ja.width/this.za.length*this.eb&&b<this.ja.width/this.za.length*(this.eb+1)&&(this.za[this.eb].url?O.k.Sc(this.za[this.eb].url):this.za[this.eb].action()));this.eb=void 0};e.ub=function(){this.jb=!0};
e.Cb=function(){this.jb&&(this.Ja.stop(),this.Uj?this.dc<this.a.Pc&&(this.dc=this.a.Pc-1):(this.ws(),this.dc=this.a.Pc-1),this.Bj?Of(this.Bj):this.ys(!1),this.Hr?Of(this.In):this.xs(!1),this.Xn?(Of(this.Rk),this.Vr&&Nf(this)):this.zs(!1),this.jb=!1)};e.Qc=function(a){a===O.ye&&(this.Fa(),this.Pd())};e.bb=function(){this.Uj&&this.a.rg&&this.a.rg.oa(0,this.Zm,this.Vj,this.Um,this.Vm,0,this.Tm);this.ja&&this.ja.u(this.vb,this.ic);this.yc=!1};
function Lf(){this.depth=100;this.i=this.visible=!0;O.b.Za(this,O.Xb);var a;this.a=O.a.q.uf;if("landscape"===O.orientation)for(a in O.a.q.lr)this.a[a]=O.a.q.lr[a];this.xa=O.a.j.nz;if(O.a.j.uf)for(a in O.a.j.uf)this.a[a]=O.a.j.uf[a];this.Vb=O.a.q.Kb;for(var b in O.a.P.uf)this.a[b]=O.a.P.uf[b];this.wf=-1;this.Ia=0;this.rr=[];J(this)}e=Lf.prototype;
e.Fa=function(){var a,b,c,d;O.b.mb(O.lf);if(a=this.a.backgroundImage?this.a.backgroundImage:void 0)c=Math.abs(O.ea),1<a.L?(b=(w.canvas.height-c)/a.lg,d=-(a.Lh*b-w.canvas.width)/2,ta(a,d,c)):(b=(w.canvas.height-c)/a.height,d=-Math.floor((a.width*b-this.canvas.width)/2),a.oa(0,d,c,b,b,0,1));var g;b=O.a.q.ia.type[O.n.ld].Dc;O.a.j.ia&&O.a.j.ia.type&&O.a.j.ia.type[O.n.ld]&&O.a.j.ia.type[O.n.ld]&&(b=!1===O.a.j.ia.type[O.n.ld].Dc?!1:b);void 0!==this.xa&&void 0!==this.xa.Dc&&(b=this.xa.Dc);c=O.b.g(this.a.ex,
this.canvas.width,vc.width);a=O.b.g(this.a.ts,O.X.height,vc.height)+O.X.top;b&&(vc.u(0,c,a),b=U.M(),C(b,this.a.ss),F(b,"center"),b.u(this.H+" / "+this.Jo,c+Math.floor(vc.width/2),a+vc.height+this.a.us));if(void 0!==this.xa&&void 0!==this.xa.Vw?this.xa.Vw:1)b=U.M(),void 0!==this.a.tw?C(b,this.a.tw):C(b,this.a.Yn),c=O.l.K("levelMapScreenTotalScore","<TOTAL SCORE:>"),d=Oa(b,c,this.a.vw,this.a.uw),d<b.fontSize&&E(b,d),d=O.b.qa(this.a.Wr,this.canvas.width,b.da(c),b.align),g=O.b.qa(this.a.Xr,O.X.height,
b.V(c),b.h)+O.X.top,b.u(c,d,g),c=""+this.Wk,C(b,this.a.Yn),d=O.b.qa(this.a.Wr,this.canvas.width,b.da(c),b.align),b.u(c,d,a+vc.height+this.a.us)};
function Pf(a){if("grid"===a.a.type){z(a.li);w.clear();a.vf=[];var b;b=function(b,d,g){var h,k,l,n,q,v,D,A,r,s,t,u,L,ca,R,W,xa,Ka,id,Rb,od,Fb,Ue;k=O.n.aa[b];id=a.Gb?a.a.Ou:a.a.Pu;Rb=a.a.fn;od=id;if(a.a.eu)h=a.a.eu[b];else{Ka=a.Gb?a.a.fw:a.a.gw;for(Fb=Math.floor(k/Ka);1<Math.abs(Fb-Ka);)Ka-=1,Fb=Math.floor(k/Ka);for(h=[];0<k;)h.push(Math.min(Ka,k)),k-=Ka}Fb=h.length;xa=Math.round(((a.Gb?a.a.sr:a.a.tr)-(Fb+1)*id)/Fb);Ue=a.a.cu?a.a.cu:!1;if(!Ue){Ka=1;for(k=0;k<Fb;k++)Ka=Math.max(h[k],Ka);W=Math.round((a.canvas.width-
2*Rb)/Ka)}for(k=n=0;k<Fb;k++){Ka=h[k];Ue&&(W=Math.round((a.canvas.width-2*Rb)/Ka));for(l=0;l<Ka;l++){r=a.a.fq;L=a.a.nu;t=O.n.Ph||"locked";u=0;q=Qf(b,n,void 0,void 0);"object"===typeof q&&null!==q&&(void 0!==q.state&&(t=q.state),"object"===typeof q.stats&&null!==q.stats&&(u=q.stats.stars||0));ca="locked"===t;"function"===typeof O.j.Lu&&(v=O.j.Lu(Rf(O.d,b,n),b,n,t))&&(L=ca=r=!1);q=Rb+d;A=od;R=s=1;if(!1!==L){D=a.Gb?qc:wc;if("played"===t)switch(u){case 1:D=a.Gb?rc:xc;break;case 2:D=a.Gb?sc:yc;break;case 3:D=
a.Gb?tc:zc}else a.Gb||"locked"!==t||(D=Cc);D.width>W&&(R=W/D.width);D.height>xa&&(R=Math.min(s,xa/D.height));q+=Math.round((W-D.width*R)/2);A+=Math.round((xa-D.height*R)/2);D.oa(0,q,A,R,R,0,1);g&&(a.vf[n]={x:q,y:A})}v&&(v.width>W&&(s=W/v.width),v.height>xa&&(s=Math.min(s,xa/v.height)),void 0!==D?(u=O.b.g(a.a.jr,D.width*R,v.width*s),L=O.b.g(a.a.kr,D.height*R,v.height*s)):(u=O.b.g(a.a.jr,W,v.width*s),L=O.b.g(a.a.kr,xa,v.height*s),g&&(a.vf[n]={x:q+u,y:A+L})),v instanceof y?v.oa(q+u,A+L,s,s,0,1):v.oa(0,
q+u,A+L,s,s,0,1));!1===r||ca||(r=""+(O.n.Pi?n+1:Rf(O.d,b,n)+1),s=a.fonts.bn,"locked"===t&&void 0!==a.fonts.vv?s=a.fonts.vv:"unlocked"===t&&void 0!==a.fonts.Ux?s=a.fonts.Ux:"played"===t&&void 0!==a.fonts.played&&(s=a.fonts.played),void 0!==D?(u=O.b.qa(a.a.nr,D.width*R,s.da(r),s.align),L=O.b.qa(a.a.or,D.height*R,s.V(r),s.h)):(u=O.b.qa(a.a.nr,W,s.da(r),s.align),L=O.b.qa(a.a.or,xa,s.V(r),s.h)),s.u(r,q+u,A+L));a.Gb&&ca&&(void 0!==D?(u=O.b.g(a.a.Ar,D.width*R,uc.width),L=O.b.g(a.a.Br,D.height*R,uc.height)):
(u=O.b.g(a.a.Ar,W,uc.width),L=O.b.g(a.a.Br,xa,uc.height)),uc.u(0,q+u,A+L));Rb+=W;n++}Rb=a.a.fn;od+=xa+id}};a.hi&&b(a.C-1,0);b(a.C,a.canvas.width,!0);a.gi&&b(a.C+1,2*a.canvas.width);B(a.li)}}function Sf(a,b){switch(b-a.C){case 0:a.Nn=0;break;case 1:a.Nn=-a.canvas.width;break;case -1:a.Nn=a.canvas.width}a.Ag=!0;a.zk=0;a.moveStart=a.Ia;a.Kr=a.Nn-a.Ia;a.xk=Math.min(a.a.aw-a.Ng,Math.round(Math.abs(a.Kr)/(a.ml/1E3)));a.xk=Math.max(a.a.$v,a.xk)}
function Tf(a){if(1<O.n.aa.length){var b,c;b=O.b.g(a.a.Zx,a.canvas.width,Bc.width);c=O.b.g(a.a.Zo,O.X.height,Bc.height)+O.X.top;a.we=new pf(b,c,a.depth-20,new Tb(Bc),[Bc],function(){a.ud="previous";Sf(a,a.C-1);return!0});b=O.b.g(a.a.Yx,a.canvas.width,Ac.width);c=O.b.g(a.a.Yo,O.X.height,Ac.height)+O.X.top;a.te=new pf(b,c,a.depth-20,new Tb(Ac),[Ac],function(){a.ud="next";Sf(a,a.C+1);return!0});Uf(a)}else a.qe-=a.a.Hq}
function Uf(a){if(1<O.n.aa.length){var b;a.hi?(b=[Bc],a.we.Ta=!0):(b=[new y(Bc.width,Bc.height)],z(b[0]),Bc.u(1,0,0),B(b[0]),a.we.Ta=!1);Vf(a.we,b);a.gi?(b=[Ac],a.te.Ta=!0):(b=[new y(Ac.width,Ac.height)],z(b[0]),Ac.u(1,0,0),B(b[0]),a.te.Ta=!1);Vf(a.te,b)}}
function Wf(a){var b,c,d;z(a.Tf);w.clear();b=U.M();a.a.Hc&&C(b,a.a.Hc);F(b,"center");G(b,"middle");c=O.l.K("levelMapScreenWorld_"+a.C,"<LEVELMAPSCREENWORLD_"+a.C+">");d=Oa(b,c,a.a.vd-(b.stroke?b.Ec:0),a.a.Ie-(b.stroke?b.Ec:0),!1);d<b.fontSize&&E(b,d);b.u(c,a.Tf.width/2,a.Tf.height/2);B(a.Tf);a.canvas.$=!0}
e.ec=function(){var a,b,c,d=this;this.Gb=this.a.Gb?!0:!1;if(!this.Gb){for(a=0;a<O.n.aa.length;a++)if(9<O.n.aa[a]){b=!0;break}b||(this.Gb=!0)}this.li=new y(3*this.canvas.width,this.Gb?this.a.sr:this.a.tr);this.pr=-this.canvas.width;this.qr=this.Gb?this.a.Gq:this.a.Iq;this.qe=O.b.g(this.qr,O.X.height,this.li.height)+O.X.top;this.Tf=new y(this.a.vd,this.a.Ie);this.Gx=O.b.g(this.a.Uf,this.canvas.width,this.a.vd);this.Zs=O.b.g(this.a.Ic,O.X.height,this.Tf.height)+O.X.top;this.mr="undefined"!==typeof s_level_mask?
s_level_mask:this.Gb?Tb(qc):Tb(wc);this.a.fq&&(this.fonts={},a=function(a){var b,c;for(b in a)c=U.M(),C(c,a[b]),d.fonts[b]=c},this.fonts={},this.fonts.bn=U,this.Gb?a(this.a.kv):a(this.a.lv));this.C=O.d.C;this.aa=O.n.aa[this.C];this.nl=!1;this.ml=this.Co=this.Ng=0;this.Do=this.pr;this.Ia=0;this.hi=0<this.C;this.gi=this.C<O.n.aa.length-1;for(b=this.Jo=this.Wk=this.H=0;b<O.n.aa.length;b++)for(a=0;a<O.n.aa[b];a++)c=Xf(void 0,a,b),this.Jo+=3,"object"===typeof c&&null!==c&&(this.H+=void 0!==c.stars?c.stars:
0,this.Wk+=void 0!==c.highScore?c.highScore:0);O.j.Nu&&(this.Wk=O.j.Nu());this.Fa();a=this.Vb[this.a.iw];this.Qn=new pf(O.b.g(this.a.jw,this.canvas.width,a.s.width),O.b.g(this.a.Rn,O.X.height,a.s.height)+O.X.top,this.depth-20,new Tb(a.s),[a.s],{U:O.d.Rd,ha:this});Tf(this);Pf(this);Wf(this);this.yc=!0};e.Yb=function(){this.we&&K(I,this.we);this.te&&K(I,this.te);K(I,this.Qn)};
e.ub=function(a,b,c){if(!this.Ag)for(a=0;a<this.vf.length;a++)if(Ub(this.mr,this.vf[a].x-this.canvas.width,this.vf[a].y+this.qe,b,c)){this.wf=a;break}this.Ag=!1;1<O.n.aa.length&&(this.nl=!0,this.Ng=0,this.Ks=this.Do=b,this.ml=this.Co=0)};
e.Cb=function(a,b,c){if(!this.Ag&&-1!==this.wf&&Ub(this.mr,this.vf[this.wf].x-this.canvas.width,this.vf[this.wf].y+this.qe,b,c)&&(a=O.n.Ph||"locked",b=Qf(this.C,this.wf,void 0,void 0),"object"===typeof b&&null!==b&&void 0!==b.state&&(a=b.state),"locked"!==a))return K(I,this),Mf(O.d,this.wf,this.C),!0;this.wf=-1;this.nl=!1;1<O.n.aa.length&&(Math.abs(this.Ia)>=this.a.yx&&(this.ml>=this.a.zx||Math.abs(this.Ia)>=this.a.xx)?"previous"===this.ud?this.hi&&0<=this.Ia&&this.Ia<=this.canvas.width/2?Sf(this,
this.C-1):(0>this.Ia||(this.ud="next"),Sf(this,this.C)):"next"===this.ud&&(this.gi&&0>=this.Ia&&this.Ia>=-this.canvas.width/2?Sf(this,this.C+1):(0<this.Ia||(this.ud="previous"),Sf(this,this.C))):0<Math.abs(this.Ia)&&(this.ud="next"===this.ud?"previous":"next",Sf(this,this.C)));return!0};
e.Qc=function(a){if(a===O.tf||a===O.ye)this.canvas.$=!0,this.Fa(),a===O.ye?(this.Zs=O.b.g(this.a.Ic,O.X.height,this.Tf.height)+O.X.top,this.qe=O.b.g(this.qr,O.X.height,this.li.height)+O.X.top,this.Qn.y=O.b.g(this.a.Rn,O.X.height,this.Qn.images[0].height)+O.X.top,this.we&&(this.we.y=O.b.g(this.a.Zo,O.X.height,Bc.height)+O.X.top),this.te&&(this.te.y=O.b.g(this.a.Yo,O.X.height,Ac.height)+O.X.top),void 0===this.te&&void 0===this.we&&(this.qe-=this.a.Hq)):(Wf(this),Pf(this))};
e.od=function(a){var b=Bb(0);this.nl&&(this.Co=Math.abs(this.Do-b),0<this.Ng&&(this.ml=this.Co/(this.Ng/1E3)),this.ud=b>this.Do?"previous":"next",this.Ng+=a,this.Ia+=b-this.Ks,this.Ks=b,this.canvas.$=!0);this.Ag&&(this.Ia=ac(this.zk,this.moveStart,this.Kr,this.xk),this.zk>=this.xk&&(this.Ag=!1,this.Ia=0),this.zk+=a,this.canvas.$=!0);if(this.Ag||this.nl)"previous"===this.ud&&this.Ia>=this.canvas.width/2?0<=this.C-1?(this.C-=1,this.aa=O.n.aa[this.C],this.hi=0<this.C,this.gi=this.C<O.n.aa.length-1,Uf(this),
this.Ia-=this.canvas.width,Wf(this),Pf(this),this.canvas.$=!0,this.moveStart-=this.canvas.width):this.Ia=Math.round(this.canvas.width/2):"next"===this.ud&&this.Ia<=-this.canvas.width/2&&(this.C+1<O.n.aa.length?(this.C+=1,this.aa=O.n.aa[this.C],this.hi=0<this.C,this.gi=this.C<O.n.aa.length-1,Uf(this),this.Ia+=this.canvas.width,Wf(this),Pf(this),this.canvas.$=!0,this.moveStart+=this.canvas.width):this.Ia=Math.round(-this.canvas.width/2))};
e.bb=function(){this.Tf.u(this.Gx,this.Zs);this.li.u(Math.round(this.pr+this.Ia),this.qe);this.yc=!1};
function Yf(a,b,c,d){this.depth=10;this.i=this.visible=!0;O.b.Za(this,O.Xb);var g;this.type=b.failed?"failed":a;this.a=O.a.q.ia;this.xa=this.a.type[this.type];if("landscape"===O.orientation)for(g in O.a.q.ir)this.a[g]=O.a.q.ir[g];for(g in O.a.P.ia)this.a[g]=O.a.P.ia[g];if(O.a.P.ia&&O.a.P.ia.type&&O.a.P.ia.type[this.type])for(g in O.a.P.ia.type[this.type])this.a[g]=O.a.P.ia.type[this.type][g];if("failed"===this.type){if(void 0!==O.a.j.ia&&O.a.j.ia.type&&void 0!==O.a.j.ia.type.failed)for(g in O.a.j.ia.type[this.type])this.xa[g]=
O.a.j.ia.type[this.type][g]}else{if(void 0!==O.a.j.ia&&void 0!==O.a.j.ia.type)for(g in O.a.j.ia.type[this.type])this.xa[g]=O.a.j.ia.type[this.type][g];for(g in O.a.j.ia)this.xa[g]=O.a.j.ia[g]}this.pa=b;this.U=c;this.ha=d;this.$w=[Pe,Qe,Re];this.Xe=[];this.Ja=new Vb;this.Ja.parent=this;J(this,!1)}
function Zf(a){var b;for(b=0;b<a.H.length;b++)$f(a.H[b]);for(b=0;b<a.If.length;b++)K(I,a.If[b]);a.If=[];a.Ha&&$f(a.Ha);a.Ha=void 0;for(b=0;b<a.buttons.length;b++)a.buttons[b].Ta=!1;a.Ja.stop();a.Ja=void 0;ag(a)}
function bg(a,b){var c;switch(b){case "title_level":c=O.l.K("levelEndScreenTitle_level","<LEVELENDSCREENTITLE_LEVEL>").replace("<VALUE>",a.pa.level);break;case "title_endless":c=O.l.K("levelEndScreenTitle_endless","<LEVELENDSCREENTITLE_ENDLESS>").replace("<VALUE>",a.pa.stage);break;case "title_difficulty":c=O.l.K("levelEndScreenTitle_difficulty","<LEVELENDSCREENTITLE_DIFFICULTY>")}void 0!==c&&a.cc(a.a.Hc,c,a.a.Uf,a.a.Ic,a.a.vd,a.a.Ie)}
function cg(a,b){var c;switch(b){case "subtitle_failed":c=O.l.K("levelEndScreenSubTitle_levelFailed","<LEVEL_FAILED>")}void 0!==c&&a.cc(a.a.Es,c,a.a.tx,a.a.ux)}
function dg(a,b,c){var d,g,h,k,l;g=O.l.K(b.key,"<"+b.key.toUpperCase()+">");d=b.ee?b.toString(b.Jf):b.toString(b.vc);h=a.a.Fi;h.align="left";h.h="top";l=U.M();C(l,h);c?(G(l,"bottom"),h=a.a.Kf,h.align="left",h.h="bottom",c=U.M(),C(c,h),h=k=0,void 0!==g&&(h+=l.da(g)+a.a.ll),void 0!==d&&(h+=c.da(d)),h=O.b.g(a.a.Ae,a.canvas.width,h)-a.c.x,void 0!==g&&(l.u(g,h,a.Yc+l.fontSize),h+=l.da(g)+a.a.ll,k+=l.V(g)),void 0!==d&&(b.ee?(d=c.V(d),l=a.Yc+l.fontSize-d,b.Oh=new eg(h,l,a.a.Kg,d,a.depth-100,b.Jf,c,a.a.Ig,
a.a.Jg,a.c,b.toString),k=Math.max(k,d)):(c.u(d,h,a.Yc+l.fontSize+a.a.As),k=Math.max(k,c.V(d)))),0<k&&(a.Yc+=k+a.a.Xc)):(void 0!==g&&(a.cc(h,g,a.a.Ae,a.a.Lf),k=a.a.Lf,"object"===typeof k?(k.offset=void 0!==k.offset?k.offset+a.a.Xc:a.a.Xc,k.offset+=l.V(g)):"number"===typeof k&&(k+=a.a.Xc+l.V(g))),void 0!==d&&(h=a.a.Kf,h.h="top",b.ee?(c=U.M(),h.align="center",C(c,h),g=O.b.g(a.a.Ae,a.canvas.width,a.a.Kg)-a.c.x,l=k-a.c.y,b.Oh=new eg(g,l,a.a.Kg,c.V(d),a.depth-100,b.Jf,c,a.a.Ig,a.a.Jg,a.c,b.toString)):a.cc(h,
d,a.a.Ae,k)))}
function fg(a,b,c){var d,g,h,k,l,n;switch(b){case "totalScore":d=""+a.pa.totalScore;g=O.l.K("levelEndScreenTotalScore","<LEVENENDSCREENTOTALSCORE>");n=0;break;case "highScore":g=O.l.K("levelEndScreenHighScore","<LEVENENDSCREENHIGHSCORE>");d=""+a.pa.highScore;break;case "timeLeft":g=O.l.K("levelEndScreenTimeLeft","<LEVENENDSCREENTIMELEFT>");d=""+a.pa.timeLeft;break;case "timeBonus":g=O.l.K("levelEndScreenTimeBonus","<LEVENENDSCREENTIMEBONUS>"),d=""+a.pa.timeBonus,n=a.pa.timeBonus}h=a.a.Fi;h.align=
"left";h.h="top";l=U.M();C(l,h);c?(G(l,"bottom"),h=a.a.Kf,h.align="left",h.h="bottom",c=U.M(),C(c,h),h=k=0,void 0!==g&&(h+=l.da(g)+a.a.ll),void 0!==d&&(h+=c.da(d)),h=O.b.g(a.a.Ae,a.canvas.width,h)-a.c.x,void 0!==g&&(l.u(g,h,a.Yc+l.fontSize),h+=l.da(g)+a.a.ll,k+=l.V(g)),void 0!==d&&(void 0!==n?(d=c.V(d),l=a.Yc+l.fontSize-d,n=new eg(h,l,a.a.Kg,d,a.depth-100,n,c,a.a.Ig,a.a.Jg,a.c),k=Math.max(k,d)):(c.u(d,h,a.Yc+l.fontSize+a.a.As),k=Math.max(k,c.V(d)))),0<k&&(a.Yc+=k+a.a.Xc)):(void 0!==g&&(a.cc(h,g,a.a.Ae,
a.a.Lf),k=a.a.Lf,"object"===typeof k?(k.offset=void 0!==k.offset?k.offset+a.a.Xc:a.a.Xc,k.offset+=l.V(g)):"number"===typeof k&&(k+=a.a.Xc+l.V(g))),void 0!==d&&(h=a.a.Kf,h.h="top",void 0!==n?(c=U.M(),h.align="center",C(c,h),g=O.b.g(a.a.Ae,a.canvas.width,a.a.Kg)-a.c.x,l=k-a.c.y,n=new eg(g,l,a.a.Kg,c.V(d),a.depth-100,n,c,a.a.Ig,a.a.Jg,a.c)):a.cc(h,d,a.a.Ae,k)));n instanceof eg&&("totalScore"===b?a.Wf=n:a.Xe.push(n))}
function gg(a,b){var c,d,g;c=O.l.K(b.key,"<"+b.key.toUpperCase()+">");d=b.ee?b.toString(b.Jf):b.toString(b.vc);void 0!==c&&a.cc(a.a.Cm,c,a.a.jq,a.a.Dm);void 0!==d&&(b.ee?(c=U.M(),d=a.a.Th,a.a.Ry||(d.align="center"),C(c,d),d=O.b.g(a.a.Ij,a.canvas.width,a.a.Hj)-a.c.x,g=O.b.g(a.a.Uh,a.canvas.height,a.a.Gj)-a.c.y,b.Oh=new eg(d,g,a.a.Hj,a.a.Gj,a.depth-100,b.Jf,c,a.a.Ig,a.a.Jg,a.c,b.toString)):a.cc(a.a.Th,d,a.a.Ij,a.a.Uh))}
function hg(a,b){var c,d,g,h;switch(b){case "totalScore":c=O.l.K("levelEndScreenTotalScore","<LEVENENDSCREENTOTALSCORE>");d=""+a.pa.totalScore;g=0;break;case "timeLeft":c=O.l.K("levelEndScreenTimeLeft","<LEVENENDSCREENTIMELEFT>"),d=""+a.pa.timeLeft}void 0!==c&&a.cc(a.a.Cm,c,a.a.jq,a.a.Dm);void 0!==d&&(void 0!==g?(c=U.M(),d=a.a.Th,d.align="center",C(c,d),d=O.b.g(a.a.Ij,a.canvas.width,a.a.Hj)-a.c.x,h=O.b.g(a.a.Uh,a.canvas.height,a.a.Gj)-a.c.y,g=new eg(d,h,a.a.Hj,a.a.Gj,a.depth-100,g,c,a.a.Ig,a.a.Jg,
a.c)):a.cc(a.a.Th,d,a.a.Ij,a.a.Uh));g instanceof eg&&("totalScore"===b?a.Wf=g:a.Xe.push(g))}e=Yf.prototype;e.cc=function(a,b,c,d,g,h){var k=U.M();C(k,a);void 0!==g&&void 0!==h&&(a=Oa(k,b,g,h,g),k.fontSize>a&&E(k,a));a=k.da(b);h=k.V(b);k.u(b,O.b.qa(c,this.canvas.width,a,k.align)-this.c.x,O.b.qa(d,this.canvas.height,h,k.h)-this.c.y,g)};
function ig(a,b){var c,d,g,h;switch(b){case "retry":c=Id;d=function(){a.he="retry";Zf(a)};break;case "exit":c=Fd,d=function(){a.he="exit";Zf(a)}}void 0!==c&&(g=O.b.g(a.a.Tt,a.canvas.width,c.width)-a.c.x,h=O.b.g(a.a.Bp,a.canvas.height,c.height)-a.c.y,a.buttons.push(new pf(g,h,a.depth-20,new Tb(c),[c],d,a.c)))}
function jg(a,b){var c,d,g,h;switch(b){case "retry":c=Qd;d=function(){a.he="retry";Zf(a)};break;case "exit":c=Pd;d=function(){a.he="exit";Zf(a)};break;case "next":c=Pd,d=function(){a.he="next";Zf(a)}}void 0!==c&&(g=O.b.g(a.a.Bu,a.canvas.width,c.width)-a.c.x,h=O.b.g(a.a.wq,a.canvas.height,c.height)-a.c.y,a.buttons.push(new pf(g,h,a.depth-20,new Tb(c),[c],d,a.c)))}
e.ec=function(){this.r=0;this.H=[];this.If=[];this.buttons=[];this.canvas.$=!0;this.he="";this.wc=this.pa.failed?!0:!1;this.Dc=this.xa.Dc&&!this.wc;this.Gg=this.xa.Gg&&!this.wc&&this.pa.Wq;this.Tl=this.alpha=this.hg=0;kg(this);var a,b,c,d,g,h,k=this;switch(this.xa.mj){case "failed":this.f=this.a.Jk.jv;break;case "level":this.f=this.a.Jk.mv;break;case "difficulty":this.f=this.a.Jk.Rh;break;case "endless":this.f=this.a.Jk.su}this.c=new lg(this.depth-10,this.ya,new y(this.f.width,this.f.height));this.c.x=
O.b.g(this.a.Db,this.canvas.width,this.f.width);this.c.y=O.b.g(this.a.Eb,this.canvas.height,this.f.height);z(this.c.f);this.f.u(0,0,0);!this.wc&&this.Dc&&(b=O.b.g(this.a.qo,this.canvas.width,0)-this.c.x,a=O.b.g(this.a.ro,this.canvas.height,s_star01_fill.height)-this.c.y+Math.round(s_star01_empty.height/2),s_star01_empty.u(0,b,a),b=O.b.g(this.a.so,this.canvas.width,0)-this.c.x,a=O.b.g(this.a.to,this.canvas.height,s_star02_fill.height)-this.c.y+Math.round(s_star02_empty.height/2),s_star02_empty.u(0,
b,a),b=O.b.g(this.a.uo,this.canvas.width,0)-this.c.x,a=O.b.g(this.a.vo,this.canvas.height,s_star03_fill.height)-this.c.y+Math.round(s_star03_empty.height/2),s_star03_empty.u(0,b,a));void 0!==this.xa.Ji&&bg(this,this.xa.Ji);void 0!==this.xa.Fs&&cg(this,this.xa.Fs);this.nb={};void 0!==this.pa.jd?(c=this.pa.jd,c.visible&&gg(this,c),this.nb[c.id]=c):void 0!==this.xa.Em&&hg(this,this.xa.Em);if(void 0!==this.pa.nb)for(a=this.pa.nb.length,b=U.M(),C(b,this.a.Fi),c=U.M(),C(c,this.a.Kf),b=Math.max(b.V("g"),
c.V("g"))*a+this.a.Xc*(a-1),this.Yc=O.b.g(this.a.Lf,this.canvas.height,b)-this.c.y,b=0;b<a;b++)c=this.pa.nb[b],c.visible&&dg(this,this.pa.nb[b],1<a),this.nb[c.id]=c;else if(void 0!==this.xa.Be)if("string"===typeof this.xa.Be)fg(this,this.xa.Be,this.a.vq);else if(this.xa.Be instanceof Array)for(a=this.xa.Be.length,b=U.M(),C(b,this.a.Fi),c=U.M(),C(c,this.a.Kf),b=Math.max(b.V("g"),c.V("g"))*a+this.a.Xc*(a-1),this.Yc=O.b.g(this.a.Lf,this.canvas.height,b)-this.c.y,b=0;b<a;b++)fg(this,this.xa.Be[b],1<a||
this.a.vq);B(this.c.f);ig(this,this.xa.jj);jg(this,this.xa.Oj);O.d.lt&&(b=O.b.g(k.a.Yu,k.canvas.width,k.a.Rq)-this.c.x,a=O.b.g(this.a.Zu,this.canvas.height,this.a.af)-this.c.y,this.Qq=new Kf("default_text",b,a,k.depth-20,"levelEndScreenViewHighscoreBtn",k.a.Rq,{U:function(){void 0!==mg?O.k.Sc(O.w.dk.url+"submit/"+mg+"/"+k.pa.totalScore):O.k.Sc(O.w.dk.url+"submit/")},Pb:!0},k.c),this.buttons.push(this.Qq),b=function(a){a&&(k.Qq.So("levelEndScreenSubmitHighscoreBtn"),k.jz=a)},ng(this.pa.totalScore,
b));b=O.b.g(this.a.Kh,this.canvas.width,this.a.jg)-this.c.x;a=O.b.g(this.a.kg,this.canvas.height,this.a.af)-this.c.y;this.buttons.push(new pf(b,a,this.depth-20,new Sb(0,0,this.a.jg,this.a.af),void 0,function(){k.he="exit";Zf(k)},this.c));for(b=0;b<this.buttons.length;b++)this.buttons[b].Ta=!1;this.c.y=-this.c.height;a=this.a.Bx;this.Ja.ua(a,this.jx);a+=this.a.Bh;g=0;d=this.a.Nx;this.Dc&&(d=Math.max(d,this.a.qs+this.a.ps*this.pa.stars));if(this.Wf&&(this.Ja.ua(a+this.a.ul,function(a,b){og(b.parent.Wf,
b.parent.pa.totalScore,d)}),g=a+this.a.ul+d,0<this.Xe.length)){h=function(a,b){var c=b.parent,d=c.Xe[c.hg];og(c.Wf,c.Wf.value+d.value,c.a.gg);og(d,0,c.a.gg);c.hg+=1};for(b=0;b<this.Xe.length;b++)g+=this.a.Kp,this.Ja.ua(g,h);g+=this.a.gg}if(void 0!==this.nb&&(g=a,h=function(a,b){var c=b.parent,d=c.zo[c.hg||0],g=c.nb[d.kl];void 0!==d.Ke&&(g.visible&&g.ee?og(g.Oh,d.Ke(g.Oh.value),c.a.gg):g.vc=d.Ke(g.vc));d.visible&&d.ee&&og(d.Oh,d.vc,c.a.gg);c.hg+=1},this.zo=[],void 0!==this.pa.jd&&void 0!==this.pa.jd.Ke&&
(this.Ja.ua(a+this.a.ul,h),this.zo.push(this.pa.jd),g+=this.a.ul+bonusCounterDuration),void 0!==this.pa.nb))for(b=0;b<this.pa.nb.length;b++)c=this.pa.nb[b],void 0!==c.Ke&&(g+=this.a.Kp,this.Ja.ua(g,h),this.zo.push(c),g+=this.a.gg);if(this.Dc){for(b=0;b<this.pa.stars;b++)a+=this.a.ps,this.Ja.ua(a,this.lx),this.Ja.ua(a,this.mx);a+=this.a.qs}a=Math.max(a,g);this.Gg&&(a+=this.a.Hv,this.Ja.ua(a,this.ix),this.Ja.ua(a,this.gx),this.Ja.ua(a+this.a.Iv,this.hx));a+=500;this.Ja.ua(a,function(){O.k.bv&&O.k.bv()});
this.Ja.ua(a+this.a.Yv,O.k.cv);O.k.Xq(this.pa);this.Ja.start();this.wc?H.play(Se):H.play(Ne)};e.wa=function(a){this.alpha=this.a.Kj*this.Tl/this.a.Wb;this.Tl+=a;this.alpha>=this.a.Kj&&(this.alpha=this.a.Kj,this.i=!1);this.canvas.$=!0};
e.jx=function(a,b){function c(){var a;for(a=0;a<d.buttons.length;a++)d.buttons[a].Ta=!0}var d=b.parent,g,h;switch(d.a.dy){case "fromLeft":h="horizontal";g=O.b.g(d.a.Db,d.canvas.width,d.c.width);d.c.x=-d.c.width;d.c.y=O.b.g(d.a.Eb,d.canvas.height,d.c.height)+Math.abs(O.ea);break;case "fromRight":h="horizontal";g=O.b.g(d.a.Db,d.canvas.width,d.c.width);d.c.x=d.canvas.width;d.c.y=O.b.g(this.parent.a.Eb,d.canvas.height,selft.c.height)+Math.abs(O.ea);break;case "fromBottom":h="vertical";g=O.b.g(d.a.Eb,
d.canvas.height,d.c.height)+Math.abs(O.ea);d.c.x=O.b.g(d.a.Db,d.canvas.width,d.c.width);d.c.y=d.canvas.height+d.c.height;break;default:h="vertical",g=O.b.g(d.a.Eb,d.canvas.height,d.c.height)+Math.abs(O.ea),d.c.x=O.b.g(d.a.Db,d.canvas.width,d.c.width),d.c.y=-d.c.height}"vertical"===h?pg(d.c,"y",g,d.a.Bh,d.a.Ul,c):pg(d.c,"x",g,d.a.Bh,d.a.Ul,c)};
function ag(a){function b(){K(I,a);a.ha?a.U.call(a.ha,a.he):a.U(a.he)}var c,d;switch(a.a.ey){case "toLeft":d="horizontal";c=-a.c.width;break;case "toRight":d="horizontal";c=a.canvas.width;break;case "toBottom":d="vertical";c=a.canvas.height+a.c.height;break;default:d="vertical",c=-a.c.height}"vertical"===d?pg(a.c,"y",c,a.a.Vl,a.a.Wl,b):pg(a.c,"x",c,a.a.Vl,a.a.Wl,b)}
e.lx=function(a,b){var c,d=b.parent,g=Math.abs(O.ea);if(d.H.length<d.pa.stars){switch(d.H.length+1){case 1:c=new lg(d.depth-30,O.Jd,s_star01_fill);c.x=O.b.g(d.a.qo,d.canvas.width,0);c.y=O.b.g(d.a.ro,d.canvas.height,s_star01_fill.height)+g+Math.round(s_star01_empty.height/2);break;case 2:c=new lg(d.depth-30,O.Jd,s_star02_fill);c.x=O.b.g(d.a.so,d.canvas.width,0);c.y=O.b.g(d.a.to,d.canvas.height,s_star02_fill.height)+g+Math.round(s_star02_empty.height/2);break;case 3:c=new lg(d.depth-30,O.Jd,s_star03_fill),
c.x=O.b.g(d.a.uo,d.canvas.width,0),c.y=O.b.g(d.a.vo,d.canvas.height,s_star03_fill.height)+g+Math.round(s_star03_empty.height/2)}c.Aa=d.a.rs;c.Ca=d.a.rs;c.alpha=d.a.dx;pg(c,"scale",1,d.a.cx,gc,function(){var a=d.H.length,b,c,n;z(d.c.f);switch(a){case 1:n=s_star01_fill;b=O.b.g(d.a.qo,d.canvas.width,0)-d.c.x;c=O.b.g(d.a.ro,d.canvas.height,s_star01_fill.height)-d.c.y+g+Math.round(s_star01_empty.height/2);break;case 2:n=s_star02_fill;b=O.b.g(d.a.so,d.canvas.width,0)-d.c.x;c=O.b.g(d.a.to,d.canvas.height,
s_star01_fill.height)-d.c.y+g+Math.round(s_star02_empty.height/2);break;case 3:n=s_star03_fill,b=O.b.g(d.a.uo,d.canvas.width,0)-d.c.x,c=O.b.g(d.a.vo,d.canvas.height,s_star01_fill.height)-d.c.y+g+Math.round(s_star03_empty.height/2)}n.u(0,b,c);B(d.c.f);d.c.yc=!0;K(I,d.H[a-1])});pg(c,"alpha",1,d.a.bx,$b);d.H.push(c);H.play(d.$w[d.H.length-1])}};
e.mx=function(a,b){var c=b.parent,d,g;d=c.H[c.If.length];g=new lg(c.depth-50,O.Jd,s_sfx_star);g.x=d.x;g.y=d.y;pg(g,"subImage",s_sfx_star.L-1,c.a.ax,void 0,function(){K(I,g)});c.If.push(g)};
e.gx=function(a,b){var c=b.parent,d,g,h,k,l,n,q;d=[];h=U.M();k=O.l.K("levelEndScreenMedal","<LEVELENDSCREENMEDAL>");c.a.Gr&&C(h,c.a.Gr);g=Oa(h,k,c.a.tk,c.a.Ov,!0);g<h.fontSize&&E(h,g);l=O.b.qa(c.a.Pv,Fc.width,h.da(k,c.a.tk),h.align);n=O.b.qa(c.a.Qv,Fc.height,h.V(k,c.a.tk),h.h);for(q=0;q<Fc.L;q++)g=new y(Fc.width,Fc.height),z(g),Fc.u(q,0,0),h.u(k,l,n,c.a.tk),B(g),d.push(g);c.Ha=new lg(c.depth-120,O.Jd,d);c.Ha.Tc=c.a.Dr;c.Ha.Uc=c.a.Er;c.Ha.x=O.b.g({align:"center"},c.c.canvas.width,c.Ha.width)-c.c.x;
c.Ha.y=O.b.g(c.a.uk,c.Ha.canvas.height,c.Ha.height)-c.c.y+Math.abs(O.ea);l=O.b.g(c.a.Hn,c.Ha.canvas.width,c.Ha.width)-c.c.x;c.Ha.Aa=c.a.sk;c.Ha.Ca=c.a.sk;c.Ha.parent=c.c;c.Ha.alpha=0;c.Ha.uy=!0;pg(c.Ha,"scale",1,c.a.zg,$b,function(){K(I,c.fb);c.fb=void 0});pg(c.Ha,"x",l,c.a.zg,$b);pg(c.Ha,"alpha",1,0,$b);pg(c.Ha,"subImage",Fc.L,c.a.Mv,$b,void 0,c.a.zg+c.a.Cr+c.a.Lv,!0,c.a.Nv)};
e.ix=function(a,b){var c,d=b.parent;d.fb=new lg(d.depth-110,O.Jd,Ec);d.fb.y=O.b.g(d.a.uk,d.fb.canvas.height,Ec.height)-d.c.y+d.a.Kv;d.fb.Tc=d.a.Dr;d.fb.Uc=d.a.Er;d.fb.x=O.b.g(d.a.Hn,d.fb.canvas.width,d.fb.width)-d.c.x;c=O.b.g(d.a.uk,d.fb.canvas.height,Ec.height)-d.c.y+Math.abs(O.ea);d.fb.Aa=d.a.sk*d.a.Fr;d.fb.Ca=d.a.sk*d.a.Fr;d.fb.alpha=0;d.fb.parent=d.c;pg(d.fb,"y",c,d.a.zg,$b);pg(d.fb,"scale",1,d.a.zg,$b);pg(d.fb,"alpha",1,d.a.zg,$b)};
e.hx=function(a,b){var c=b.parent;c.se=new lg(c.depth-130,O.Jd,Dc);c.se.parent=c.c;c.se.x=c.Ha.x;c.se.y=c.Ha.y+c.a.Jv;pg(c.se,"subImage",Dc.L-1,c.a.Cr,void 0,function(){K(I,c.se);c.se=void 0});H.play(We)};
e.Yb=function(){var a;for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);for(a=0;a<this.H.length;a++)K(I,this.H[a]);for(a=0;a<this.If.length;a++)K(I,this.If[a]);this.Ha&&(K(I,this.Ha),this.se&&K(I,this.se),this.fb&&K(I,this.fb));K(I,this.c);this.Ja&&this.Ja.stop();this.Wf&&K(I,this.Wf);for(a=0;a<this.Xe.length;a++)K(I,this.Xe[a]);qg()};e.bb=function(){var a=w.context.globalAlpha;w.context.globalAlpha=this.alpha;pa(0,0,w.canvas.width,w.canvas.height,this.a.pq,!1);w.context.globalAlpha=a};
function rg(a,b,c,d){this.depth=-100;this.visible=!1;this.i=!0;O.b.Za(this,O.Xb);var g,h;this.a=c?O.a.q.Or:O.a.q.options;if("landscape"===O.orientation)for(g in h=c?O.a.q.Sz:O.a.q.kw,h)this.a[g]=h[g];this.Vb=O.a.q.Kb;h=c?O.a.P.Or:O.a.P.options;for(g in h)this.a[g]=h[g];if(O.w.options&&O.w.options.buttons)for(g in O.w.options.buttons)this.a.buttons[g]=O.w.options.buttons[g];this.type=a;this.Px=b;this.Mc=c;this.gl=!1!==d;J(this)}e=rg.prototype;
e.Ah=function(a,b,c,d,g){var h=void 0,k=void 0,l=void 0,n=void 0,q=void 0,v=void 0;switch(a){case "music":h="music_toggle";n=this.bt;l=O.d.ve()?"on":"off";break;case "music_big":h="music_big_toggle";n=this.bt;l=O.d.ve()?"on":"off";break;case "sfx_big":h="sfx_big_toggle";n=this.ct;l=O.d.Vk()?"on":"off";break;case "sfx":h="sfx_toggle";n=this.ct;l=O.d.Vk()?"on":"off";break;case "language":h="language_toggle";n=this.at;l=O.d.language();break;case "tutorial":h="default_text";k="optionsTutorial";n=this.Bi;
break;case "highScores":h="default_text";k="optionsHighScore";n=this.ds;this.im=this.Tw;break;case "moreGames":void 0!==O.w.Xv?(h="default_image",v=O.w.Xv):(h="default_text",k="optionsMoreGames");n=this.Uw;q=!0;break;case "resume":h="default_text";k="optionsResume";n=this.close;break;case "exit":h="default_text";k="optionsExit";n=O.Cg.customFunctions&&"function"===typeof O.Cg.customFunctions.exit?O.Cg.customFunctions.exit:function(){};break;case "quit":h="default_text";k="optionsQuit";n=this.Fw;break;
case "restart":h="default_text";k="optionsRestart";n=this.Kw;break;case "startScreen":h="default_text";k="optionsStartScreen";n=this.ds;this.im=this.Ww;break;case "about":h="default_text";k="optionsAbout";n=this.Rw;break;case "forfeitChallenge":h="default_text";k="optionsChallengeForfeit";n=this.Zh;break;case "cancelChallenge":h="default_text",k="optionsChallengeCancel",n=this.Ih}void 0!==h&&void 0!==n&&("image"===this.Vb[h].type?this.buttons.push(new sg(h,b,c,this.depth-20,v,d,{U:n,ha:this,Pb:q},
this.c)):"toggleText"===this.Vb[h].type?this.buttons.push(new Gf(h,b,c,this.depth-20,l,d,{U:n,ha:this,Pb:q},this.c)):"text"===this.Vb[h].type?this.buttons.push(new Kf(h,b,c,this.depth-20,k,d,{U:n,ha:this,Pb:q},this.c)):"toggle"===this.Vb[h].type&&this.buttons.push(new tg(h,b,c,this.depth-20,l,{U:n,ha:this,Pb:q},this.c)),this.buttons[this.buttons.length-1].Ta=g||!1)};
e.ds=function(){var a=this;pg(a.c,"y","inGame"!==this.type?-this.c.f.height:this.canvas.height,this.a.Fk,this.a.Gk,function(){K(I,a);void 0!==a.im&&a.im.call(a)});return!0};
e.Fa=function(a,b){var c,d,g,h;z(this.c.f);w.clear();this.a.backgroundImage.u(0,0,0);c=O.l.K("optionsTitle","<OPTIONS_TITLE>");d=U.M();this.a.Hc&&C(d,this.a.Hc);void 0!==this.a.vd&&void 0!==this.a.Ie&&(g=Oa(d,c,this.a.vd,this.a.Ie,this.a.vd),d.fontSize>g&&E(d,g));g=O.b.qa(this.a.Uf,this.canvas.width,d.da(c),d.align)-a;h=O.b.qa(this.a.Ic,this.canvas.height,d.V(c,d.h))-b+-1*O.ea;d.u(c,g,h);B(this.c.f)};
e.Te=function(a,b,c){var d,g,h,k,l,n,q;h=!1;var v=this.a.buttons[this.type];"inGame"===this.type&&O.a.j.kf.Ir&&(v=O.a.j.kf.Ir);if("function"!==typeof ug())for(d=0;d<v.length;d++){if("string"===typeof v[d]&&"moreGames"===v[d]){v.splice(d,1);break}for(g=0;g<v[d].length;g++)if("moreGames"===v[d][g]){v[d].splice(g,1);break}}if(!1===O.w.ve||!1===O.d.mk)for(d=0;d<v.length;d++)if(v[d]instanceof Array){for(g=0;g<v[d].length;g++)if("music"===v[d][g]){O.d.nk?v[d]="sfx_big":v.splice(d,1);h=!0;break}if(h)break}else if("music_big"===
v[d]){v.splice(d,1);break}if(!O.d.nk)for(d=0;d<v.length;d++)if(v[d]instanceof Array){for(g=0;g<v[d].length;g++)if("sfx"===v[d][g]){!1!==O.w.ve&&O.d.mk?v[d]="music_big":v.splice(d,1);h=!0;break}if(h)break}else if("sfx_big"===v[d]){v.splice(d,1);break}if(1===O.l.Ku().length)for(d=0;d<v.length;d++)if("language"===v[d]){v.splice(d,1);break}h=this.Vb.default_text.s.height;k=this.a.tj;a=O.b.g(this.a.sj,this.canvas.width,k)-a;n=O.b.g(this.a.Gh,this.c.f.height,h*v.length+this.a.dd*(v.length-1))-b+-1*O.ea;
for(d=0;d<v.length;d++){l=a;q=k;if("string"===typeof v[d])this.Ah(v[d],l,n,q,c);else for(b=v[d],q=(k-(b.length-1)*this.a.dd)/b.length,g=0;g<b.length;g++)this.Ah(b[g],l,n,q,c),l+=q+this.a.dd;n+=h+this.a.dd}};e.bt=function(a){var b=!0;"off"===a?(b=!1,O.Ba.Sa("off","options:music")):O.Ba.Sa("on","options:music");O.d.ve(b);return!0};e.ct=function(a){var b=!0;"off"===a?(b=!1,O.Ba.Sa("off","options:sfx")):O.Ba.Sa("on","options:sfx");O.d.Vk(b);return!0};
e.at=function(a){O.l.fs(a);O.Ba.Sa(a,"options:language");return!0};
e.Bi=function(){function a(){l.kc+=1;l.Bi();return!0}function b(){l.kc-=1;l.Bi();return!0}function c(){var a;l.Fa(n,q);l.$e.Ta=!0;for(a=0;a<l.buttons.length;a++)K(I,l.buttons[a]);l.buttons=[];l.Te(n,q,!0)}var d,g,h,k,l=this,n=O.b.g(l.a.Db,l.canvas.width,l.a.backgroundImage.width),q=O.b.g(l.a.Eb,l.canvas.height,l.a.backgroundImage.height)+-1*O.ea;void 0===l.kc&&(l.kc=0);l.Li=void 0!==O.j.Fq?O.j.Fq():[];O.Ba.Sa((10>l.kc?"0":"")+l.kc,"options:tutorial");for(d=0;d<l.buttons.length;d++)K(I,l.buttons[d]);
l.buttons=[];this.Mc?(z(l.c.f),w.clear(),l.$e.Ta=!1):l.Fa(n,q);z(l.c.f);void 0!==l.a.$c&&(d=O.b.g(l.a.wl,l.c.f.width,l.a.$c.width),g=O.b.g(l.a.Je,l.c.f.height,l.a.$c.height),l.a.$c.u(0,d,g));k=l.Li[l.kc].title;void 0!==k&&""!==k&&(h=U.M(),l.a.yl&&C(h,l.a.yl),d=Oa(h,k,l.a.zl,l.a.Oo,l.a.zl),h.fontSize>d&&E(h,d),d=O.b.qa(l.a.kt,l.c.f.width,h.da(k,l.a.zl),h.align),g=O.b.qa(l.a.Po,l.c.f.height,h.V(k,l.a.Oo),h.h),h.u(k,d,g));l.kc<l.Li.length&&(h=l.Li[l.kc].f,d=O.b.g(l.a.ht,l.c.f.width,h.width),g=O.b.g(l.a.Mo,
l.c.f.height,h.height),h.u(0,d,g),k=l.Li[l.kc].text,h=U.M(),l.a.xl&&C(h,l.a.xl),d=Oa(h,k,l.a.Tg,l.a.it,l.a.Tg),h.fontSize>d&&E(h,d),d=O.b.qa(l.a.jt,l.c.f.width,h.da(k,l.a.Tg),h.align),g=O.b.qa(l.a.No,l.c.f.height,h.V(k,l.a.Tg),h.h),h.u(k,d,g,l.a.Tg));B(l.c.f);h=Yc;d=O.b.g(l.a.gt,l.canvas.width,h.width)-l.c.x;g=O.b.g(l.a.Lo,l.canvas.height,h.height)-l.c.y-O.ea;0<=l.kc-1?l.buttons.push(new pf(d,g,l.depth-20,new Tb(h),[h],{U:b,ha:l},l.c)):(h=Wc,l.buttons.push(new pf(d,g,l.depth-20,new Tb(h),[h],{U:c,
ha:l},l.c)));h=Xc;d=O.b.g(this.a.ft,l.canvas.width,h.width)-l.c.x;g=O.b.g(this.a.Ko,l.canvas.height,h.height)-l.c.y-O.ea;l.kc+1<l.Li.length?l.buttons.push(new pf(d,g,l.depth-20,new Tb(h),[h],{U:a,ha:l},l.c)):(h=Wc,l.buttons.push(new pf(d,g,l.depth-20,new Tb(h),[h],{U:c,ha:l},l.c)));return!0};
e.Rw=function(){function a(a,b,c,g,h,k){var l;l=U.M();b&&C(l,b);b=Oa(l,a,h,k,h);l.fontSize>b&&E(l,b);c=O.b.qa(c,d.c.f.width,l.da(a,h),l.align);g=O.b.qa(g,d.c.f.height,l.V(a,k),l.h);l.u(a,c,g,h);return g+k}function b(a,b,c){b=O.b.g(b,d.c.f.width,a.width);c=O.b.g(c,d.c.f.height,a.height);a.u(0,b,c);return c+a.height}var c,d=this,g=O.b.g(d.a.Db,d.canvas.width,d.a.backgroundImage.width),h=O.b.g(d.a.Eb,d.canvas.height,d.a.backgroundImage.height)+-1*O.ea;O.Ba.Sa("about","options");for(c=0;c<d.buttons.length;c++)K(I,
d.buttons[c]);d.buttons=[];this.Mc?(z(d.c.f),w.clear(),d.$e.Ta=!1):d.Fa(g,h);z(d.c.f);void 0!==d.a.$c&&b(d.a.$c,d.a.wl,d.a.Je);var k=null;"function"===typeof O.k.eq?k=O.k.eq(d.a,a,b,d.c.f):(c=O.l.K("optionsAbout_header","<OPTIONSABOUT_HEADER>"),a(c,d.a.cj,d.a.ej,d.a.vh,d.a.dj,d.a.pp),b($c,d.a.wh,d.a.fj),c=O.l.K("optionsAbout_text","<OPTIONSABOUT_TEXT>"),a(c,d.a.xh,d.a.cg,d.a.zh,d.a.Se,d.a.yh));a(O.l.K("optionsAbout_version","<OPTIONSABOUT_VERSION>")+" "+vf()+("big"===O.size?"b":"s"),d.a.Rl,d.a.sp,
d.a.Sl,d.a.rp,d.a.qp);B(d.c.f);if(k)for(c=0;c<k.length;++c){var l=k[c];d.buttons.push(new pf(l.x,l.y,d.depth-10,Sb(0,0,l.width,l.height),null,{U:function(a){return function(){O.k.Sc(a)}}(l.url),Pb:!0},d.c))}else void 0!==O.w.Tq&&(c=O.b.g(d.a.wh,d.c.f.width,$c.width),k=O.b.g(d.a.fj,d.c.f.height,$c.height),c=Math.min(c,O.b.g(d.a.cg,d.c.f.width,d.a.Se)),k=Math.min(k,O.b.g(d.a.zh,d.c.f.height,d.a.yh)),l=Math.max(d.a.Se,$c.width),d.buttons.push(new pf(c,k,d.depth-10,Sb(0,0,l,O.b.g(d.a.zh,d.c.f.height,
d.a.yh)+d.a.yh-k),null,{U:function(){O.k.Sc(O.w.Tq)},Pb:!0},d.c)));d.buttons.push(new Kf("default_text",O.b.g(d.a.Ql,d.c.f.width,d.a.uh),d.a.th,d.depth-20,"optionsAbout_backBtn",d.a.uh,{U:function(){var a;d.Fa(g,h);d.$e.Ta=!0;for(a=0;a<d.buttons.length;a++)K(I,d.buttons[a]);d.buttons=[];d.Te(g,h,!0);d.js=!1},ha:d},d.c));return this.js=!0};
function vg(a){var b,c,d,g,h,k=O.b.g(a.a.Db,a.canvas.width,a.a.backgroundImage.width),l=O.b.g(a.a.Eb,a.canvas.height,a.a.backgroundImage.height)+-1*O.ea;O.Ba.Sa("versions","options");for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Fa(k,l);z(a.c.f);void 0!==a.a.$c&&a.a.$c.u(0,O.b.g(a.a.wl,a.c.width,a.a.$c.width),O.b.g(a.a.Je,a.c.height,a.a.$c.height));h=U.M();C(h,a.a.Rl);F(h,"left");c=a.a.tt;d=a.a.ut;for(b in O.version)g=b+": "+O.version[b],h.u(g,c,d),d+=h.V(g)+a.a.st;c=O.b.g(a.a.Ql,
a.c.f.width,a.a.uh);d=a.a.th;a.buttons.push(new Kf("default_text",c,d,a.depth-20,"optionsAbout_backBtn",a.a.uh,{U:function(){var b;a.Fa(k,l);for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Te(k,l,!0)},ha:a},a.c))}e.Tw=function(){return!0};e.Uw=function(){O.Ba.Sa("moreGames","options");var a=ug();"function"===typeof a&&a();return!0};
e.Fw=function(){var a=this;wg(this,"optionsQuitConfirmationText","optionsQuitConfirmBtn_Yes","optionsQuitConfirmBtn_No",function(){O.Ba.Sa("confirm_yes","options:quit");K(I,a);wf(O.Ba,O.d.Sf,xg(O.d),"progression:levelQuit:"+yg());zg();Ag(O.d);return!0})};
e.Kw=function(){var a=this;wg(this,"optionsRestartConfirmationText","optionsQuitConfirmBtn_Yes","optionsQuitConfirmBtn_No",function(){O.Ba.Sa("confirm_yes","options:restart");K(I,a);var b=O.d;b.state="LEVEL_END";wf(O.Ba,O.d.Sf,xg(O.d),"progression:levelRestart:"+yg());b=O.n.Pi?b.ib+1:Rf(b)+1;O.d.ia=!0;O.d.hr="retry";Bg(O.d,!0);b={failed:!0,level:b,restart:!0};O.k.wg(b);O.bd.wg(b);return!0})};
e.Zh=function(){var a,b=this;a=function(a){var d=a?"challengeForfeitMessage_success":"challengeForfeitMessage_error";Cg(b,O.l.K(d,"<"+d.toUpperCase()+">"));a&&(b.$e.Ta=!1,b.gl||kg())};wg(this,"challengeForfeitConfirmText","challengeForfeitConfirmBtn_yes","challengeForfeitConfirmBtn_no",function(){O.d.Zh(a);return!0})};
e.Ih=function(){var a,b=this;a=function(a){var d=a?"challengeCancelMessage_success":"challengeCancel_error";Cg(b,O.l.K(d,"<"+d.toUpperCase()+">"));a&&(b.$e.Ta=!1,b.gl||kg())};wg(this,"challengeCancelConfirmText","challengeCancelConfirmBtn_yes","challengeCancelConfirmBtn_no",function(){O.d.Ih(a);return!0})};
function wg(a,b,c,d,g){var h,k,l,n;for(h=0;h<a.buttons.length;h++)K(I,a.buttons[h]);a.buttons=[];b=O.l.K(b,"<"+b.toUpperCase()+">");h=U.M();a.a.Vp?C(h,a.a.Vp):a.a.Zk&&C(h,a.a.Zk);k=Oa(h,b,a.a.yj,a.a.qm,!0);k<h.fontSize&&E(h,k);n=h.da(b,a.a.yj)+10;l=h.V(b,a.a.yj)+10;k=O.b.qa(a.a.Wp,a.c.f.width,n,h.align);l=O.b.qa(a.a.rm,a.c.f.height,l,h.h);z(a.c.f);h.u(b,k,l,n);B(a.c.f);k=O.b.g(a.a.Tp,a.canvas.width,a.a.Mh)-a.c.x;l=O.b.g(a.a.om,a.canvas.height,a.Vb.default_text.s.height)-a.c.y-O.ea;a.buttons.push(new Kf("default_text",
k,l,a.depth-20,d,a.a.Mh,{U:function(){var b,c,d;c=O.b.g(a.a.Db,a.canvas.width,a.a.backgroundImage.width);d=O.b.g(a.a.Eb,a.canvas.height,a.a.backgroundImage.height)+-1*O.ea;a.Fa(c,d);for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Te(c,d,!0);return!0},ha:a},a.c));k=O.b.g(a.a.Up,a.canvas.width,a.a.Mh)-a.c.x;l=O.b.g(a.a.pm,a.canvas.height,a.Vb.default_text.s.height)-a.c.y-O.ea;a.buttons.push(new Kf("default_text",k,l,a.depth-20,c,a.a.Mh,{U:function(){return"function"===typeof g?g():!0},
ha:a},a.c))}function Cg(a,b){var c,d,g,h;for(c=0;c<a.buttons.length;c++)K(I,a.buttons[c]);a.buttons=[];d=O.b.g(a.a.Db,a.canvas.width,a.a.backgroundImage.width);g=O.b.g(a.a.Eb,a.canvas.height,a.a.backgroundImage.height)+-1*O.ea;a.Fa(d,g);c=U.M();a.a.Kn&&C(c,a.a.Kn);d=Oa(c,b,a.a.Ln,a.a.Tv,!0);d<c.fontSize&&E(c,d);h=c.da(b,a.a.Ln)+10;g=c.V(b,a.a.Ln)+10;d=O.b.qa(a.a.Uv,a.c.f.width,h,c.align);g=O.b.qa(a.a.Vv,a.c.f.height,g,c.h);z(a.c.f);c.u(b,d,g,h);B(a.c.f)}
e.Ww=function(){O.Ba.Sa("startScreen","options");Ag(O.d);return!0};e.close=function(){K(I,this);return this.canvas.$=!0};
e.ec=function(){var a,b;this.gl&&kg(this);O.d.Bd=this;this.tq=this.sq=!1;a=this.a.backgroundImage;this.c=new lg(this.depth-10,this.ya,new y(a.width,a.height));this.c.x=O.b.g(this.a.Db,this.canvas.width,a.width);a=O.b.g(this.a.Eb,this.canvas.height,a.height)+-1*O.ea;this.c.y=a;this.Fa(this.c.x,this.c.y);this.buttons=[];this.Px?this.Bi():this.Te(this.c.x,this.c.y);this.$e=new pf(this.a.Kh,this.a.kg,this.depth-20,new Sb(0,0,this.a.jg,this.a.af),void 0,{U:this.close,ha:this},this.c);this.Vg="versions";
this.Ue=new Wb;O.b.Za(this.Ue,O.Xb);Lb(this.Ue,this.depth-1);Xb(this.Ue,"keyAreaLeft",this.c.x,this.c.y+this.a.Je,this.a.dg,this.a.gj,76);Xb(this.Ue,"keyAreaRight",this.c.x+this.c.width-this.a.dg,this.c.y+this.a.Je,this.a.dg,this.a.gj,82);Xb(this.Ue,"keyAreaCentre",O.Av/2-this.a.dg/2,this.c.y+this.a.Je,this.a.dg,this.a.gj,67);b=this;this.c.y="inGame"!==this.type?this.canvas.height:-this.c.f.height;pg(this.c,"y",a,this.a.si,this.a.ti,function(){var a;for(a=0;a<b.buttons.length;a++)b.buttons[a].Ta=
!0})};e.Yb=function(){var a;this.gl&&qg();this.sq&&la(O.tf,O.l.dn());this.tq&&la(O.ye);for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);this.Ue.clear();K(I,this.Ue);K(I,this.$e);K(I,this.c);O.d.Bd=null};e.Cb=function(){return!0};e.ub=function(){return!0};e.vg=function(a){this.js&&(67===a?this.Vg="":76===a?this.Vg+="l":82===a&&(this.Vg+="r"),"lrl"===this.Vg&&vg(this))};e.Qc=function(a){a===O.tf?(this.Fa(this.c.x,this.c.y),this.sq=!0):a===O.ye?this.tq=!0:a===O.St&&this.close()};
function Dg(){this.depth=-200;this.i=this.visible=!0;O.b.Za(this,O.lf);var a;this.a=O.a.q.Rj;if("landscape"===O.orientation&&O.a.q.Rm)for(a in O.a.q.Rm)this.a[a]=O.a.q.Rm[a];this.Vb=O.a.q.Kb;for(a in O.a.P.Rj)this.a[a]=O.a.P.Rj[a];J(this)}
Dg.prototype.Fa=function(){var a,b,c,d;c=this.a.backgroundImage;d=(O.xv-Math.abs(O.ea))/c.lg;this.c.f=new y(d*c.Lh,d*c.lg);z(this.c.f);this.c.y=Math.abs(O.ea);a=w.context;1E-4>Math.abs(d)||1E-4>Math.abs(d)||(a.save(),a.translate(0,0),a.rotate(-0*Math.PI/180),a.scale(d,d),a.globalAlpha=1,ta(c,0,0),a.restore());c=U.M();C(c,this.a.font);d=O.l.K("gameEndScreenTitle","<GAMEENDSCREENTITLE>");a=Oa(c,d,this.a.ql-(c.stroke?c.Ec:0),this.a.Ax-(c.stroke?c.Ec:0),!0);a<c.fontSize&&E(c,a);a=O.b.qa(this.a.Ss,this.canvas.width,
c.da(d),c.align);b=O.b.qa(this.a.Ts,this.canvas.height,c.V(d),c.h);c.u(d,a,b,this.a.ql);B(this.c.f);this.c.canvas.$=!0};Dg.prototype.ec=function(){var a=this,b=this.a.backgroundImage,b=new y(b.width,b.height);this.c=new lg(this.depth,O.Xb,b);this.c.x=0;this.c.y=Math.abs(O.ea);this.Fa();this.button=new Kf(this.a.Lp,O.b.g(this.a.au,this.canvas.width,this.a.Mp),O.b.g(this.a.Np,this.canvas.height,this.Vb[this.a.Lp].s.height),this.depth-10,"gameEndScreenBtnText",this.a.Mp,function(){K(I,a);Ag(O.d)},this.c)};
Dg.prototype.Yb=function(){K(I,this.c);K(I,this.button)};Dg.prototype.Qc=function(a){a!==O.tf&&a!==O.ye||this.Fa()};
function pf(a,b,c,d,g,h,k){function l(a,b,c){var d,g;g=O.b.cn(q.canvas);a=Math.round(q.x+q.parent.x-q.Tc*q.Aa);d=Math.round(q.y+q.parent.y-q.Uc*q.Ca);if(q.images&&0<q.rf||0<q.Gi)q.rf=0,q.Gi=0,q.canvas.$=!0;if(q.yi&&q.Ta&&Ub(q.Ac,a,d,b-g.x,c-g.y))return q.yi=!1,void 0!==q.ha?q.Dk.call(q.ha,q):q.Dk(q)}function n(a,b,c){var d,g,h;h=O.b.cn(q.canvas);d=Math.round(q.x+q.parent.x-q.Tc*q.Aa);g=Math.round(q.y+q.parent.y-q.Uc*q.Ca);if(q.Ta&&Ub(q.Ac,d,g,b-h.x,c-h.y))return q.yi=!0,q.images&&(1<q.images.length?
(q.rf=1,q.canvas.$=!0):1<q.images[0].L&&(q.Gi=1,q.canvas.$=!0)),void 0!==typeof Oe&&H.play(Oe),q.hf=a,!0}this.depth=c;this.i=this.visible=!0;this.group="TG_Token";O.b.Za(this,O.Xb);this.Uc=this.Tc=0;this.x=a;this.y=b;this.width=g?g[0].width:d.Xa-d.Da;this.height=g?g[0].height:d.rb-d.Ra;this.alpha=this.Ca=this.Aa=1;this.Qa=0;this.Ac=d;this.images=g;this.Gi=this.rf=0;this.yi=!1;this.Ta=!0;this.parent=void 0!==k?k:{x:0,y:0};this.cl=this.bl=0;this.yc=!0;this.Dk=function(){};this.Pb=!1;"object"===typeof h?
(this.Dk=h.U,this.ha=h.ha,this.Pb=h.Pb):"function"===typeof h&&(this.Dk=h);var q=this;this.Pb?(this.sg=n,this.ug=l):(this.ub=n,this.Cb=l);J(this)}function Jf(a,b,c,d,g,h){void 0===a.fe&&(a.fe=[]);a.fe.push({type:b,start:d,sc:g,Ma:c,duration:h,r:0})}
function Of(a){var b,c;if(void 0!==a.fe){for(b=0;b<a.fe.length;b++)if(c=a.fe[b],c.i){switch(c.type){case "xScale":a.Aa=c.start+c.sc;break;case "yScale":a.Ca=c.start+c.sc;break;case "alpha":a.alpha=c.start+c.sc;break;case "angle":a.Qa=c.start+c.sc;break;case "x":a.x=c.start+c.sc;break;case "y":a.y=c.start+c.sc}c.i=!1}a.canvas.$=!0}}function Vf(a,b){a.images=b;a.canvas.$=!0}e=pf.prototype;e.gs=function(a){this.visible=this.i=a};e.Yb=function(){this.images&&(this.canvas.$=!0)};
e.wa=function(a){var b,c;if(void 0!==this.fe){for(b=0;b<this.fe.length;b++)switch(c=this.fe[b],c.r+=a,c.type){case "xScale":var d=this.Aa,g=this.bl;this.Aa=c.Ma(c.r,c.start,c.sc,c.duration);this.bl=-(this.images[0].width*this.Aa-this.images[0].width*c.start)/2;if(isNaN(this.Aa)||isNaN(this.bl))this.Aa=d,this.bl=g;break;case "yScale":d=this.Ca;g=this.cl;this.Ca=c.Ma(c.r,c.start,c.sc,c.duration);this.cl=-(this.images[0].height*this.Ca-this.images[0].height*c.start)/2;if(isNaN(this.Ca)||isNaN(this.cl))this.Ca=
d,this.cl=g;break;case "alpha":this.alpha=c.Ma(c.r,c.start,c.sc,c.duration);break;case "angle":this.Qa=c.Ma(c.r,c.start,c.sc,c.duration);break;case "x":d=this.x;this.x=c.Ma(c.r,c.start,c.sc,c.duration);isNaN(this.x)&&(this.x=d);break;case "y":d=this.y,this.y=c.Ma(c.r,c.start,c.sc,c.duration),isNaN(this.y)&&(this.y=d)}this.canvas.$=!0}};
e.od=function(){var a,b,c;c=O.b.cn(this.canvas);a=Math.round(this.x+this.parent.x-this.Tc*this.Aa);b=Math.round(this.y+this.parent.y-this.Uc*this.Ca);this.yi&&!Ub(this.Ac,a,b,Bb(this.hf)-c.x,I.na[this.hf].y-c.y)&&(this.images&&(this.Gi=this.rf=0,this.canvas.$=!0),this.yi=!1)};
e.bb=function(){var a,b;a=Math.round(this.x+this.parent.x-this.Tc*this.Aa);b=Math.round(this.y+this.parent.y-this.Uc*this.Ca);this.images&&(this.images[this.rf]instanceof y?this.images[this.rf].oa(a,b,this.Aa,this.Ca,this.Qa,this.alpha):this.images[this.rf].oa(this.Gi,a,b,this.Aa,this.Ca,this.Qa,this.alpha));this.yc=!1};
function Kf(a,b,c,d,g,h,k,l){this.Y=O.a.q.Kb[a];a=void 0!==O.a.P.buttons?O.a.q.rj[O.a.P.buttons[a]||O.a.P.buttons.default_color]:O.a.q.rj[O.a.q.buttons.default_color];this.font=U.M();a.font&&C(this.font,a.font);this.Y.fontSize&&E(this.font,this.Y.fontSize);this.N=g;this.text=O.l.K(this.N,"<"+g.toUpperCase()+">");void 0!==h&&(this.width=h);this.height=this.Y.s.height;this.f={source:this.Y.s,sa:this.Y.sa,gb:this.Y.gb};g=this.Dd(this.f);h=new Sb(0,0,g[0].width,g[0].height);pf.call(this,b,c,d,h,g,k,l)}
O.b.ki(Kf);e=Kf.prototype;e.al=function(a){this.text=O.l.K(this.N,"<"+this.N.toUpperCase()+">");a&&C(this.font,a);Vf(this,this.Dd(this.f))};e.So=function(a,b){this.N=a;this.al(b)};e.Ni=function(a,b,c){"string"===typeof b&&(this.text=b);c&&C(this.font,c);a instanceof x?this.f.source=a:void 0!==a.sa&&void 0!==a.gb&&void 0!==a.source&&(this.f=a);Vf(this,this.Dd(this.f))};
e.Dd=function(a){var b,c,d,g,h,k,l=a.sa+a.gb;d=this.height-(this.Y.Gc||0);var n=a.source;c=this.font.da(this.text);void 0===this.width?b=c:"number"===typeof this.width?b=this.width-l:"object"===typeof this.width&&(void 0!==this.width.width?b=this.width.width-l:(void 0!==this.width.minWidth&&(b=Math.max(this.width.minWidth-l,c)),void 0!==this.width.maxWidth&&(b=Math.min(this.width.maxWidth-l,c))));c=Oa(this.font,this.text,b,d,!0);c<this.Y.fontSize?E(this.font,c):E(this.font,this.Y.fontSize);c=a.sa;
d=this.font.align;"center"===d?c+=Math.round(b/2):"right"===d&&(c+=b);d=Math.round(this.height/2);void 0!==this.Y.Fc&&(d+=this.Y.Fc);h=[];for(g=0;g<n.L;g++)k=new y(b+l,this.height),z(k),n.ra(g,0,0,a.sa,this.height,0,0,1),n.Dj(g,a.sa,0,n.width-l,this.height,a.sa,0,b,this.height,1),n.ra(g,a.sa+n.width-l,0,a.gb,this.height,a.sa+b,0,1),this.font.u(this.text,c,d,b),B(k),h.push(k);return h};e.Qc=function(a){a===O.tf&&this.al()};
function sg(a,b,c,d,g,h,k,l){this.Y=O.a.q.Kb[a];void 0!==h&&(this.width=h);this.height=this.Y.s.height;this.cd={source:this.Y.s,sa:this.Y.sa,gb:this.Y.gb};this.f=g;a=this.Dd();g=new Sb(0,0,a[0].width,a[0].height);pf.call(this,b,c,d,g,a,k,l)}O.b.ki(sg);
sg.prototype.Dd=function(){var a,b,c,d,g,h,k,l=this.cd.sa+this.cd.gb;b=this.height-(this.Y.Gc||0);var n=this.cd.source;void 0===this.width?a=this.f.width:"number"===typeof this.width?a=this.width-l:"object"===typeof this.width&&(void 0!==this.width.width?a=this.width.width-l:(void 0!==this.width.minWidth&&(a=Math.max(this.width.minWidth-l,this.f.width)),void 0!==this.width.maxWidth&&(a=Math.min(this.width.maxWidth-l,this.f.width))));k=Math.min(a/this.f.width,b/this.f.height);k=Math.min(k,1);g=Math.round(this.cd.sa+
(a-this.f.width*k)/2);h=Math.round((b-this.f.height*k)/2);c=[];for(b=0;b<n.L;b++){d=new y(a+l,this.height);z(d);n.ra(b,0,0,this.cd.sa,this.height,0,0,1);n.Dj(b,this.cd.sa,0,n.width-l,this.height,this.cd.sa,0,a,this.height,1);n.ra(b,this.cd.sa+n.width-l,0,this.cd.gb,this.height,this.cd.sa+a,0,1);try{w.context.drawImage(this.f,g,h,this.f.width*k,this.f.height*k)}catch(q){}B(d);c.push(d)}return c};O.b.ki(function(a,b,c,d,g,h,k){pf.call(this,a,b,c,g,d,h,k)});
function Gf(a,b,c,d,g,h,k,l){var n;this.Y=O.a.q.Kb[a];a=void 0!==O.a.P.buttons?O.a.q.rj[O.a.P.buttons[a]||O.a.P.buttons.default_color]:O.a.q.rj[O.a.q.buttons.default_color];this.font=U.M();a.font&&C(this.font,a.font);this.Y.fontSize&&E(this.font,this.Y.fontSize);void 0!==h&&(this.width=h);this.height=this.Y.s.height;this.T=this.Y.T;if(this.T.length){for(h=0;h<this.T.length;h++)if(this.T[h].id===g){this.Ea=h;break}void 0===this.Ea&&(this.Ea=0);this.text=O.l.K(this.T[this.Ea].N,"<"+this.T[this.Ea].id.toUpperCase()+
">");this.Vf=this.T[this.Ea].s;h=this.Dd();a=new Sb(0,0,h[0].width,h[0].height);n=this;"function"===typeof k?g=function(){n.Gf();return k(n.T[n.Ea].id)}:"object"===typeof k?(g={},g.Pb=k.Pb,g.ha=this,g.U=function(){n.Gf();return k.U.call(k.ha,n.T[n.Ea].id)}):g=function(){n.Gf()};pf.call(this,b,c,d,a,h,g,l)}}O.b.ki(Gf);e=Gf.prototype;
e.Gf=function(a){var b;if(void 0===a)this.Ea=(this.Ea+1)%this.T.length;else for(b=0;b<this.T.length;b++)if(this.T[b].id===a){this.Ea=b;break}this.Ni(this.T[this.Ea].s,O.l.K(this.T[this.Ea].N,"<"+this.T[this.Ea].id.toUpperCase()+">"))};e.al=function(a){a&&C(this.font,a);this.text=O.l.K(this.T[this.Ea].N,"<"+this.T[this.Ea].id.toUpperCase()+">");Vf(this,this.Dd())};e.Ni=function(a,b,c){this.text=b;this.Vf=a;c&&C(this.font,c);Vf(this,this.Dd())};
e.Dd=function(){var a,b,c,d,g,h,k=this.Y.sa,l=this.Y.gb,n=k+l;g=Math.abs(k-l);d=this.height-(this.Y.Gc||0);var q=this.Y.s,v=this.font.M();b=v.da(this.text);void 0===this.width?a=b:"number"===typeof this.width?a=this.width-n:"object"===typeof this.width&&(void 0!==this.width.width?a=this.width.width-n:(void 0!==this.width.minWidth&&(a=Math.max(this.width.minWidth-n,b)),void 0!==this.width.maxWidth&&(a=Math.min(this.width.maxWidth-n,b))));d=Oa(v,this.text,a,d,!0);d<v.fontSize&&E(v,d);b=v.da(this.text,
a);d=k;c=v.align;"center"===c?d=a-g>=b?d+Math.round((a-g)/2):d+(this.Y.Pf+Math.round(b/2)):"left"===c?d+=this.Y.Pf:"right"===c&&(d+=a);g=Math.round(this.height/2);void 0!==this.Y.Fc&&(g+=this.Y.Fc);c=[];for(b=0;b<q.L;b++)h=new y(a+n,this.height),z(h),q.ra(b,0,0,k,this.height,0,0,1),q.Dj(b,k,0,q.width-n,this.height,k,0,a,this.height,1),q.ra(b,k+q.width-n,0,l,this.height,k+a,0,1),this.Vf.u(0,this.Y.Pg,this.Y.Qg),v.u(this.text,d,g,a),B(h),c.push(h);return c};e.Qc=function(a){a===O.tf&&this.al()};
function tg(a,b,c,d,g,h,k){var l;this.T=O.a.q.Kb[a].T;if(this.T.length){for(a=0;a<this.T.length;a++)if(this.T[a].id===g){this.Ea=a;break}void 0===this.Ea&&(this.Ea=0);this.Vf=this.T[this.Ea].s;a=new Tb(this.Vf);l=this;g="function"===typeof h?function(){l.Gf();return h(l.T[l.Ea].id)}:"object"===typeof h?{ha:this,U:function(){l.Gf();return h.U.call(h.ha,l.T[l.Ea].id)}}:function(){l.Gf()};pf.call(this,b,c,d,a,[this.Vf],g,k)}}O.b.ki(tg);
tg.prototype.Gf=function(a){var b;if(void 0===a)this.Ea=(this.Ea+1)%this.T.length;else for(b=0;b<this.T.length;b++)if(this.T[b].id===a){this.Ea=b;break}this.Ni(this.T[this.Ea].s)};tg.prototype.Ni=function(a){this.Vf=a;Vf(this,[].concat(this.Vf))};
function Eg(a,b,c,d){this.depth=10;this.visible=!1;this.i=!0;O.b.Za(this,O.Xb);var g;this.a=O.a.q.lk;if("landscape"===O.orientation&&O.a.q.wn)for(g in O.a.q.wn)this.a[g]=O.a.q.wn[g];for(g in O.a.P.lk)this.a[g]=O.a.P.lk[g];this.qn=a;this.Yl=b;this.U=c;this.ha=d;this.vi="entering";this.dt=!1;J(this,!1);Mb(this,"LevelStartDialog")}
function Fg(a){var b,c,d,g,h;if("leaving"!==a.vi){a.vi="leaving";a.We=0;b=function(){K(I,a);a.ha?a.U.call(a.ha):a.U&&a.U()};if(void 0!==a.a.Hk)for(c=0;c<a.a.Hk.length;c++)d=a.a.Hk[c],g=void 0,d.qj&&(a.We++,g=b),h=d.end,"x"===d.type?h=O.b.g(h,a.canvas.width,a.c.f.width):"y"===d.type&&(h=O.b.g(h,a.canvas.height,a.c.f.height)+Math.abs(O.ea)),pg(a.c,d.type,h,d.duration,d.Ma,g,d.va,d.loop,d.Dn);0===a.We&&b()}}e=Eg.prototype;
e.ec=function(){var a,b,c,d,g,h,k=this;a=this.a.Bc;b=a.width;g=a.height;this.c=new lg(this.depth+10,this.ya,new y(b,g));z(this.c.f);a.u(0,0,0);""!==this.Yl&&(c=O.b.g(this.a.xp,b,0),d=O.b.g(this.a.yp,g,0),a=U.M(),C(a,this.a.wp),void 0!==this.a.Ch&&void 0!==this.a.Xl&&(h=Oa(a,this.Yl,this.a.Ch,this.a.Xl,this.a.Ch),a.fontSize>h&&E(a,h)),a.u(this.Yl,c,d,this.a.Ch));""!==this.qn&&(c=O.b.g(this.a.Mq,b,0),d=O.b.g(this.a.Nq,g,0),a=U.M(),C(a,this.a.Kq),void 0!==this.a.ck&&void 0!==this.a.Lq&&(h=Oa(a,this.qn,
this.a.ck,this.a.Lq,this.a.ck),a.fontSize>h&&E(a,h)),a.u(this.qn,c,d,this.a.ck));B(this.c.f);this.c.x=O.b.g(this.a.Sr,this.canvas.width,b);this.c.y=O.b.g(this.a.Ik,this.canvas.height,g)+Math.abs(O.ea);this.We=0;a=function(){k.We--;0===k.We&&(k.vi="paused")};if(void 0!==this.a.ui)for(b=0;b<this.a.ui.length;b++)g=this.a.ui[b],c=void 0,g.qj&&(this.We++,c=a),d=g.end,"x"===g.type?d=O.b.g(d,this.canvas.width,this.c.f.width):"y"===g.type&&(d=O.b.g(d,this.canvas.height,this.c.f.height)+Math.abs(O.ea)),pg(this.c,
g.type,d,g.duration,g.Ma,c,g.va,g.loop,g.Dn),void 0!==g.Rb&&H.play(g.Rb);0===this.We&&(this.vi="paused");this.r=0};e.Yb=function(){K(I,this.c)};e.wa=function(a){"paused"!==this.state&&(this.r+=a,this.r>=this.a.Ur&&Fg(this))};e.ub=function(){return this.dt=!0};e.Cb=function(){this.dt&&"paused"===this.vi&&Fg(this);return!0};
function lg(a,b,c){this.depth=a;this.i=this.visible=!0;O.b.Za(this,b);this.f=c;this.ob=0;this.width=c.width;this.height=c.height;this.Uc=this.Tc=this.y=this.x=0;this.Ca=this.Aa=1;this.Qa=0;this.alpha=1;this.hb=[];this.vp=0;this.parent={x:0,y:0};this.yc=!0;J(this,!1)}
function pg(a,b,c,d,g,h,k,l,n){var q,v=0<k;switch(b){case "x":q=a.x;break;case "y":q=a.y;break;case "xScale":q=a.Aa;break;case "yScale":q=a.Ca;break;case "scale":b="xScale";q=a.Aa;pg(a,"yScale",c,d,g,void 0,k,l,n);break;case "angle":q=a.Qa;break;case "alpha":q=a.alpha;break;case "subImage":q=0}a.hb.push({id:a.vp,r:0,i:!0,Aj:v,type:b,start:q,end:c,Lb:h,duration:d,Ma:g,va:k,loop:l,Dn:n});a.vp++}
function $f(a){var b;for(b=a.hb.length-1;0<=b;b--){switch(a.hb[b].type){case "x":a.x=a.hb[b].end;break;case "y":a.y=a.hb[b].end;break;case "xScale":a.Aa=a.hb[b].end;break;case "yScale":a.Ca=a.hb[b].end;break;case "angle":a.Qa=a.hb[b].end;break;case "alpha":a.alpha=a.hb[b].end;break;case "subImage":a.ob=a.hb[b].end}"function"===typeof a.hb[b].Lb&&a.hb[b].Lb.call(a)}}
lg.prototype.wa=function(a){var b,c,d;for(b=0;b<this.hb.length;b++)if(c=this.hb[b],c.i&&(c.r+=a,c.Aj&&c.r>=c.va&&(c.r%=c.va,c.Aj=!1),!c.Aj)){c.r>=c.duration?(d=c.end,c.loop?(c.Aj=!0,c.va=c.Dn,c.r%=c.duration):("function"===typeof c.Lb&&c.Lb.call(this),this.hb[b]=void 0)):"subImage"===c.type?(d=this.f instanceof Array?this.f.length:this.f.L,d=Math.floor(c.r*d/c.duration)):d=c.Ma(c.r,c.start,c.end-c.start,c.duration);switch(c.type){case "x":this.x=d;break;case "y":this.y=d;break;case "xScale":this.Aa=
d;break;case "yScale":this.Ca=d;break;case "angle":this.Qa=d;break;case "alpha":this.alpha=d;break;case "subImage":this.ob=d}this.canvas.$=!0}for(b=this.hb.length-1;0<=b;b--)void 0===this.hb[b]&&this.hb.splice(b,1)};
lg.prototype.bb=function(){var a,b,c;b=Math.round(this.x-this.Aa*this.Tc)+this.parent.x;c=Math.round(this.y-this.Ca*this.Uc)+this.parent.y;a=this.f;a instanceof Array&&(a=this.f[this.ob%this.f.length]);a instanceof y?a.oa(b,c,this.Aa,this.Ca,this.Qa,this.alpha):a.oa(this.ob,b,c,this.Aa,this.Ca,this.Qa,this.alpha);this.yc=!1};
function eg(a,b,c,d,g,h,k,l,n,q,v){this.depth=g;this.visible=!0;this.i=!1;O.b.Za(this,O.Xb);this.x=a;this.y=b;this.Fn=l;this.Gn="object"===typeof n?n.top:n;this.Bv="object"===typeof n?n.bottom:n;this.da=c;this.V=d;this.width=this.da+2*this.Fn;this.height=this.V+this.Gn+this.Bv;this.value=h||0;this.parent=q||{x:0,y:0};this.font=k;this.toString="function"===typeof v?v:function(a){return a+""};this.alpha=1;this.Ff=this.Ef=this.Uc=this.Tc=0;c=new y(this.width,this.height);this.fg=new lg(this.depth,this.ya,
c);this.fg.x=a-this.Fn;this.fg.y=b-this.Gn;this.fg.parent=q;this.Na=this.fg.f;this.xe();J(this)}eg.prototype.Yb=function(){K(I,this.fg)};function og(a,b,c){a.i=!0;a.dm=a.value;a.value=a.dm;a.end=b;a.duration=c;a.Ma=M;a.r=0}
eg.prototype.xe=function(){var a,b;a=this.font.align;b=this.font.h;var c=this.Fn,d=this.Gn;this.Cp||(this.Na.clear(),this.canvas.$=!0);z(this.Na);this.Cp&&this.Cp.ra(0,this.jy,this.ky,this.iy,this.gy,0,0,1);"center"===a?c+=Math.round(this.da/2):"right"===a&&(c+=this.da);"middle"===b?d+=Math.round(this.V/2):"bottom"===b&&(d+=this.V);b=this.toString(this.value);a=Oa(this.font,b,this.da,this.V,!0);a<this.font.fontSize&&E(this.font,a);this.font.u(b,c,d,this.da);B(this.Na);this.fg.yc=!0};
eg.prototype.wa=function(a){var b;b=Math.round(this.Ma(this.r,this.dm,this.end-this.dm,this.duration));this.r>=this.duration?(this.value=this.end,this.i=!1,this.xe()):b!==this.value&&(this.value=b,this.xe());this.r+=a};function Gg(a,b,c){this.depth=-100;this.visible=!1;this.i=!0;this.yw=a;O.b.Za(this,O.Xb);this.a=O.a.q.vm;this.Vb=O.a.q.Kb;this.Op=b;for(var d in O.a.P.vm)this.a[d]=O.a.P.vm[d];this.Tn=!1!==c;J(this)}e=Gg.prototype;e.at=function(){};
e.Ah=function(a,b,c,d,g){b=new Kf("default_text",b,c,this.depth-20,a.N||"NO_TEXT_KEY_GIVEN",d,{U:function(){a.U&&(a.ha?a.U.call(a.ha,a):a.U(a))},ha:this},this.c);this.buttons.push(b);a.text&&b.Ni(b.f,a.text);this.buttons[this.buttons.length-1].Ta=g||!1};
e.Fa=function(a,b,c){z(this.c.f);w.clear();this.a.backgroundImage.u(0,0,0);a=c?c:this.yw;b=U.M();this.a.$r&&C(b,this.a.$r);c=Oa(b,a,this.a.ao,this.a.$n,!0);c<b.fontSize&&E(b,c);c=b.da(a,this.a.ao)+10;var d=b.V(a,this.a.$n)+10;b.u(a,O.b.qa(this.a.Dw,this.c.f.width,c,b.align),O.b.qa(this.a.Ew,this.c.f.height-Hg(this),d,b.h),c);B(this.c.f)};function Hg(a){var b=a.Op;return O.b.g(a.a.Gh,a.c.f.height,a.Vb.default_text.s.height*b.length+a.a.dd*(b.length-1))}
e.Te=function(a,b){var c,d,g,h,k,l,n,q,v,D=[],D=this.Op;g=this.Vb.default_text.s.height;h=this.a.tj;k=O.b.g(this.a.sj,this.canvas.width,h)-a;q=Hg(this);for(c=D.length-1;0<=c;c--){n=k;v=h;if("object"===typeof D[c]&&D[c].hasOwnProperty("length")&&D[c].length)for(l=D[c],v=(h-(l.length-1)*this.a.dd)/l.length,d=0;d<l.length;d++)this.Ah(l[d],n,q,v,b),n+=v+this.a.dd;else this.Ah(D[c],n,q,v,b);q-=g+this.a.dd}};
e.show=function(){var a,b;for(a=0;a<this.buttons.length;a++)b=this.buttons[a],b.gs(!0);this.c.visible=!0};e.close=function(){K(I,this);return this.canvas.$=!0};function Ig(a){var b=O.d.de;b.Fa(b.c.x,b.c.y,a);for(a=0;a<b.buttons.length;a++)K(I,b.buttons[a]);b.canvas.$=!0}
e.ec=function(){var a,b;this.Tn&&kg(this);a=this.a.backgroundImage;this.c=new lg(this.depth-10,this.ya,new y(a.width,a.height));this.c.x=O.b.g(this.a.Db,this.canvas.width,a.width);a=O.b.g(this.a.Eb,this.canvas.height,a.height)+-1*("landscape"===O.orientation?O.a.q.lm:O.a.q.Cd).wk;this.c.y=a;this.Fa(this.c.x,this.c.y);this.buttons=[];this.Te(this.c.x);b=this;this.c.y=-this.c.f.height;pg(this.c,"y",a,this.a.si,this.a.ti,function(){var a;for(a=0;a<b.buttons.length;a++)b.buttons[a].Ta=!0})};
e.Yb=function(){var a;this.Tn&&qg();for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);K(I,this.c);O.d.Bd===this&&(O.d.Bd=null)};e.Cb=function(){return!0};e.ub=function(){return!0};
function Jg(a){if(null===a||"undefined"===typeof a)return"";a+="";var b="",c,d,g=0;c=d=0;for(var g=a.length,h=0;h<g;h++){var k=a.charCodeAt(h),l=null;if(128>k)d++;else if(127<k&&2048>k)l=String.fromCharCode(k>>6|192,k&63|128);else if(55296!==(k&63488))l=String.fromCharCode(k>>12|224,k>>6&63|128,k&63|128);else{if(55296!==(k&64512))throw new RangeError("Unmatched trail surrogate at "+h);l=a.charCodeAt(++h);if(56320!==(l&64512))throw new RangeError("Unmatched lead surrogate at "+(h-1));k=((k&1023)<<
10)+(l&1023)+65536;l=String.fromCharCode(k>>18|240,k>>12&63|128,k>>6&63|128,k&63|128)}null!==l&&(d>c&&(b+=a.slice(c,d)),b+=l,c=d=h+1)}d>c&&(b+=a.slice(c,g));return b}
function Df(a){function b(a){var b="",c="",d;for(d=0;3>=d;d++)c=a>>>8*d&255,c="0"+c.toString(16),b+=c.substr(c.length-2,2);return b}function c(a,b,c,d,g,h,l){a=k(a,k(k(c^(b|~d),g),l));return k(a<<h|a>>>32-h,b)}function d(a,b,c,d,g,h,l){a=k(a,k(k(b^c^d,g),l));return k(a<<h|a>>>32-h,b)}function g(a,b,c,d,g,h,l){a=k(a,k(k(b&d|c&~d,g),l));return k(a<<h|a>>>32-h,b)}function h(a,b,c,d,g,h,l){a=k(a,k(k(b&c|~b&d,g),l));return k(a<<h|a>>>32-h,b)}function k(a,b){var c,d,g,h,k;g=a&2147483648;h=b&2147483648;
c=a&1073741824;d=b&1073741824;k=(a&1073741823)+(b&1073741823);return c&d?k^2147483648^g^h:c|d?k&1073741824?k^3221225472^g^h:k^1073741824^g^h:k^g^h}var l=[],n,q,v,D,A,r,s,t,u;a=Jg(a);l=function(a){var b,c=a.length;b=c+8;for(var d=16*((b-b%64)/64+1),g=Array(d-1),h=0,k=0;k<c;)b=(k-k%4)/4,h=k%4*8,g[b]|=a.charCodeAt(k)<<h,k++;b=(k-k%4)/4;g[b]|=128<<k%4*8;g[d-2]=c<<3;g[d-1]=c>>>29;return g}(a);r=1732584193;s=4023233417;t=2562383102;u=271733878;a=l.length;for(n=0;n<a;n+=16)q=r,v=s,D=t,A=u,r=h(r,s,t,u,l[n+
0],7,3614090360),u=h(u,r,s,t,l[n+1],12,3905402710),t=h(t,u,r,s,l[n+2],17,606105819),s=h(s,t,u,r,l[n+3],22,3250441966),r=h(r,s,t,u,l[n+4],7,4118548399),u=h(u,r,s,t,l[n+5],12,1200080426),t=h(t,u,r,s,l[n+6],17,2821735955),s=h(s,t,u,r,l[n+7],22,4249261313),r=h(r,s,t,u,l[n+8],7,1770035416),u=h(u,r,s,t,l[n+9],12,2336552879),t=h(t,u,r,s,l[n+10],17,4294925233),s=h(s,t,u,r,l[n+11],22,2304563134),r=h(r,s,t,u,l[n+12],7,1804603682),u=h(u,r,s,t,l[n+13],12,4254626195),t=h(t,u,r,s,l[n+14],17,2792965006),s=h(s,t,
u,r,l[n+15],22,1236535329),r=g(r,s,t,u,l[n+1],5,4129170786),u=g(u,r,s,t,l[n+6],9,3225465664),t=g(t,u,r,s,l[n+11],14,643717713),s=g(s,t,u,r,l[n+0],20,3921069994),r=g(r,s,t,u,l[n+5],5,3593408605),u=g(u,r,s,t,l[n+10],9,38016083),t=g(t,u,r,s,l[n+15],14,3634488961),s=g(s,t,u,r,l[n+4],20,3889429448),r=g(r,s,t,u,l[n+9],5,568446438),u=g(u,r,s,t,l[n+14],9,3275163606),t=g(t,u,r,s,l[n+3],14,4107603335),s=g(s,t,u,r,l[n+8],20,1163531501),r=g(r,s,t,u,l[n+13],5,2850285829),u=g(u,r,s,t,l[n+2],9,4243563512),t=g(t,
u,r,s,l[n+7],14,1735328473),s=g(s,t,u,r,l[n+12],20,2368359562),r=d(r,s,t,u,l[n+5],4,4294588738),u=d(u,r,s,t,l[n+8],11,2272392833),t=d(t,u,r,s,l[n+11],16,1839030562),s=d(s,t,u,r,l[n+14],23,4259657740),r=d(r,s,t,u,l[n+1],4,2763975236),u=d(u,r,s,t,l[n+4],11,1272893353),t=d(t,u,r,s,l[n+7],16,4139469664),s=d(s,t,u,r,l[n+10],23,3200236656),r=d(r,s,t,u,l[n+13],4,681279174),u=d(u,r,s,t,l[n+0],11,3936430074),t=d(t,u,r,s,l[n+3],16,3572445317),s=d(s,t,u,r,l[n+6],23,76029189),r=d(r,s,t,u,l[n+9],4,3654602809),
u=d(u,r,s,t,l[n+12],11,3873151461),t=d(t,u,r,s,l[n+15],16,530742520),s=d(s,t,u,r,l[n+2],23,3299628645),r=c(r,s,t,u,l[n+0],6,4096336452),u=c(u,r,s,t,l[n+7],10,1126891415),t=c(t,u,r,s,l[n+14],15,2878612391),s=c(s,t,u,r,l[n+5],21,4237533241),r=c(r,s,t,u,l[n+12],6,1700485571),u=c(u,r,s,t,l[n+3],10,2399980690),t=c(t,u,r,s,l[n+10],15,4293915773),s=c(s,t,u,r,l[n+1],21,2240044497),r=c(r,s,t,u,l[n+8],6,1873313359),u=c(u,r,s,t,l[n+15],10,4264355552),t=c(t,u,r,s,l[n+6],15,2734768916),s=c(s,t,u,r,l[n+13],21,
1309151649),r=c(r,s,t,u,l[n+4],6,4149444226),u=c(u,r,s,t,l[n+11],10,3174756917),t=c(t,u,r,s,l[n+2],15,718787259),s=c(s,t,u,r,l[n+9],21,3951481745),r=k(r,q),s=k(s,v),t=k(t,D),u=k(u,A);return(b(r)+b(s)+b(t)+b(u)).toLowerCase()}var mg;
function Kg(a,b){var c=O.w.dk.url+"api";try{var d=new XMLHttpRequest;d.open("POST",c);d.setRequestHeader("Content-Type","application/x-www-form-urlencoded");d.onload=function(){"application/json"===d.getResponseHeader("Content-Type")&&b(JSON.parse(d.responseText))};d.onerror=function(a){console.log("error: "+a)};d.send(a)}catch(g){}}function Lg(a){Kg("call=api_is_valid",function(b){a(b.is_valid)})}
function ng(a,b){Kg("call=is_highscore&score="+a,function(a){0<=a.position?(mg=a.code,b(void 0!==mg)):b(!1)})}
TG_StatObjectFactory={Ey:function(a){return new TG_StatObject("totalScore",a,"levelEndScreenTotalScore_"+a,0,0,!0,!0)},Cy:function(a){return new TG_StatObject("highScore",a,"levelEndScreenHighScore_"+a,Mg(),Mg(),!0)},By:function(a,b,c,d,g){return new TG_StatObject(a,b,c,0,d,g,!0,"max"===O.n.mg?function(a){return a+d}:function(a){return a-d})},Dy:function(a,b,c,d,g){return new TG_StatObject(a,b,c,0,d,g,!0,"max"===O.n.mg?function(a){return a-d}:function(a){return a+d})}};
TG_StatObject=function(a,b,c,d,g,h,k,l,n){this.id=a;this.type=b;this.key=c;this.vc=d;this.Jf=void 0!==g?g:this.vc;this.visible=void 0!==h?h:!0;this.ee=void 0!==k?k:this.vc!==this.Jf;this.Ke=l;this.kl=void 0!==n?n:"totalScore";switch(this.type){case "text":this.toString=function(a){return a};break;case "number":this.toString=function(a){return a+""};break;case "time":this.toString=function(a){return O.b.Ho(1E3*a)}}};
TG_StatObject.prototype.M=function(){return new TG_StatObject(this.id,this.type,this.key,this.vc,this.Jf,this.visible,this.ee,this.Ke,this.kl)};O.version=O.version||{};O.version.tg="2.13.0";function Ng(a){this.depth=-99;O.b.Za(this,O.Xb);this.i=!0;this.visible=!1;this.d=a;J(this)}Ng.prototype.ak=function(){};Ng.prototype.vg=function(){};Ng.prototype.ub=function(a,b,c){a:{var d=this.d,g;for(g=0;g<d.mc.length;++g)if(d.mc[g].ub&&d.mc[g].ub(a,b,c)){a=!0;break a}a=!1}return a};
Ng.prototype.Cb=function(a,b,c){var d;a:if(d=this.d,d.$a&&a===d.Uo)a=d.$a.a.x,b=d.$a.a.y,d.$a.Sn&&(a=d.$a.Sn.x,b=d.$a.Sn.y),Og?console.log("Component:\n x: tgScale("+(a+d.$a.Xf.x-Pg)+") + GameUISettingsOffsets.X,\n y: tgScale("+(b+d.$a.Xf.y-Qg)+") + GameUISettingsOffsets.Y,"):console.log("Component:\n x: tgScale("+(a+d.$a.Xf.x)+"),\n y: tgScale("+(b+d.$a.Xf.y)+"),"),d.mt=!1,d=!0;else{for(var g=0;g<d.mc.length;++g)if(d.mc[g].Cb&&d.mc[g].Cb(a,b,c)){d=!0;break a}d=!1}return d};
function Rg(){this.ya=this.depth=0;this.zm=this.Fb=this.i=this.visible=!1;this.mc=[];this.Jj={};this.Jj.Qd=!1;this.nq={};this.paused=this.nq.Qd=!1;this.ox=new y(0,0);this.qx=this.px=0;this.$a=null;this.Uo=this.ot=this.nt=-1;this.mt=!1;this.xb=this.wb=0;this.gk=null}e=Rg.prototype;e.ec=function(){this.gk=new Ng(this)};e.Yb=function(){this.gk&&(K(I,this.gk),this.gk=null)};
function Sg(a,b,c){for(var d in b){var g=b[d];g.f?c[d]=new Tg(a,g):g.Us?c[d]=new Ug(a,O.l.K(g.Us,"<"+g.Us+">"),g):g.N?c[d]=new Ug(a,O.l.K(g.N,"<"+g.N+">"),g):g.text&&(c[d]=new Ug(a,g.text,g))}}function Vg(a,b){a.Qd&&(a.r+=b,a.r>=a.duration&&(a.Qd=!1,a.Lb&&a.Lb()))}
e.wa=function(a){Vg(this.Jj,a);Vg(this.nq,a);for(var b=0;b<this.mc.length;++b)this.mc[b].wa(a);if(this.$a&&this.mt){a=Bb(this.Uo);b=I.na[this.Uo].y;this.canvas===O.b.qf(O.mf)&&this.$a.Yj(this.wb+O.pf,this.xb+O.me);var c=a-this.nt,d=b-this.ot;this.$a.x+=c;this.$a.y+=d;this.$a.Xf.x+=c;this.$a.Xf.y+=d;this.nt=a;this.ot=b;this.Fb=!0}};e.od=function(){if(this.Fb){var a=O.b.qf(O.mf);this.canvas!==a?this.canvas.$=this.Fb:(w.mb(a),this.bb())}};
e.Fj=function(a,b){for(var c=O.b.qf(O.mf)===this.canvas,d=0;d<this.mc.length;++d){var g=this.mc[d];g.visible&&(c&&g.Yj(a,b),g.bb(a,b))}};e.bb=function(){var a=0,b=0;O.b.qf(O.Wj)!==this.canvas&&(a=O.pf,b=O.me);this.paused?this.ox.u(this.px+this.wb+a,this.qx+this.xb+b):this.Fj(this.wb+a,this.xb+b);this.Fb=!1};function Wg(){this.Oq=[];this.oq=[];this.hs=null;this.$l=void 0;this.Pm=!0}
function Xg(a){function b(a,b){if(!b)return!1;var g=0;if("string"===typeof a){if(d(a))return!1}else for(g=0;g<a.length;++g)if(d(a[g]))return!1;if(b.Jy){if("string"===typeof a){if(c(a))return!0}else for(g=0;g<a.length;++g)if(c(a[g]))return!0;return!1}return!0}function c(a){for(var b in k)if(b===a||k[b]===a)return!0;return!1}function d(a){for(var b in h)if(b===a||h[b]===a)return!0;return!1}var g;if(a instanceof Wg){if(1!==arguments.length)throw"When using GameUIOptions as argument to GameUIController constructor you should not use extraComponents of gameUiSettings as parameters anymore.";
g=a}else g=new Wg,g.Oq=arguments[0],g.oq=arguments[1],g.hs=arguments[2];var h=null,k=null,l=null,h=g.Oq,k=g.oq,l=g.hs;this.Eg=g;void 0===this.Eg.$l&&(this.Eg.$l=!Ff(O.d));Rg.apply(this,arguments);J(this);this.i=this.visible=!0;k=k||[];h=h||[];this.Xs=2;this.Qw=!1;this.o=l||Yg;this.aq=O.Wj;void 0!==this.o.ya&&(this.aq=this.o.ya);O.b.Za(this,this.aq);this.Wi=this.Vi=0;this.o.background.Uq&&(this.Vi=this.o.background.Uq);this.o.background.Vq&&(this.Wi=this.o.background.Vq);this.o.background.elements||
(this.Jc=this.o.background.f);this.o.background.fy?(Sg(this,this.o.background.elements,{}),this.Jc=this.o.background.f):(g=this.o.background.f,l=new Rg,Sg(l,this.o.background.elements,[]),g||this.ya!==O.mf?(this.Jc=new y(g.width,g.height),z(this.Jc),g.u(0,0,0),l.Fj(-this.Vi,-this.Wi),B(this.Jc)):(w.mb(O.b.qf(this.ya)),l.bb()));var n=this;this.Zq=0;b("score",this.o.R)?(this.ze=new Zg(this,this.o.R,"SCORE",0,!0),this.o.Lw&&new Tg(this,this.o.Lw)):this.ze=new $g(0,0);this.ii=b("highScore",this.o.Pq)?
new Zg(this,this.o.Pq,"HIGHSCORE",0,!1):new $g(0,0);b("highScore",this.o.Sq)&&new Tg(this,this.o.Sq);b(["stage","level"],this.o.Zw)&&new Zg(this,this.o.Zw,"STAGE",0,!1);b("lives",this.o.nv)&&new Zg(this,this.o.nv,"LIVES",0,!1);this.sl=b("time",this.o.time)?new Zg(this,this.o.time,"TIME",0,!1,function(a){return n.Ho(a)}):new $g(0,0);this.sl.Hf(36E4);if(this.o.Vc&&this.o.Zr)throw"Don't define both progress and progressFill in your game_ui settings";b("progress",this.o.Vc)?this.o.Vc.round?new ah(this,
this.o.Vc):new bh(this,this.o.Vc):b("progress",this.o.Zr)&&new bh(this,this.o.Zr);b("lives",this.o.Xu)&&new Tg(this,this.o.Xu);b("difficulty",this.o.Rh)?new Ug(this,ch().toUpperCase(),this.o.Rh):ch();b("difficulty",this.o.df)&&(g=kd,g=(this.o.df.images?this.o.df.images:[ld,kd,jd])[Hf()],this.o.df.f||(this.o.df.f=g),this.lu=new Tg(this,this.o.df),this.lu.es(g));this.o.sf&&!this.o.sf.length&&(this.o.sf=[this.o.sf]);this.o.Ld&&!this.o.Ld.length&&(this.o.Ld=[this.o.Ld]);this.dr=[];this.er=[];this.dr[0]=
b(["item","item0"],this.o.sf)?new Tg(this,this.o.sf[0]):new $g(0,"");this.er[0]=b(["item","item0"],this.o.Ld)?new Ug(this,"",this.o.Ld[0]):new $g(0,"");if(this.o.sf&&this.o.Ld)for(g=1;g<this.o.Ld.length;++g)b("item"+g,this.o.Ld[g])&&(this.er[g]=new Ug(this,"0 / 0",this.o.Ld[g]),this.dr[g]=new Tg(this,this.o.sf[g]));for(var q in this.o)g=this.o[q],g.N&&new Ug(this,O.l.K(g.N,"<"+g.N+">")+(g.separator?g.separator:""),g);this.ur=this.Ys=0;this.buttons={};for(q in this.o.buttons)g=dh(this,this.o.buttons[q]),
this.buttons[q]=g;this.o.Tr&&(g=dh(this,this.o.Tr),this.buttons.pauseButton=g);this.tm={};for(q in this.o.tm)g=this.o.tm[q],g=new eh[g.yy](this,g),this.tm[q]=g;this.xb=this.wb=0}kf(Rg,Xg);var eh={};function dh(a,b){var c=new fh(a,b,b.Y);a.mc.push(c);c.Zy=b;return c}e=Xg.prototype;e.no=function(a,b){this.buttons[b||"pauseButton"].no(a)};e.Ho=function(a){var b=Math.floor(a/6E4),c=Math.floor(a%6E4/1E3);return this.Qw?(c=Math.floor(a/1E3),c.toString()):b+(10>c?":0":":")+c};
e.setTime=function(a){this.sl.Hf(a);return this};e.getTime=function(){return this.sl.W()};function gh(a,b){a.ze.Hf(b);a.Eg.$l&&(a.ii.W()<b?a.ii.Hf(b):b<a.ii.W()&&a.ii.Hf(Math.max(b,a.Zq)))}function hh(a,b){a.ii.Hf(b);a.Zq=b}e.eg=function(a){gh(this,this.ze.W()+a);return this};e.Yb=function(){Rg.prototype.Yb.apply(this,arguments);w.mb(this.canvas);w.clear();for(var a in this.buttons)K(I,this.buttons[a])};
e.wa=function(a){1===this.Xs&&this.setTime(this.getTime()+a);if(2===this.Xs){if(this.Ys&&1E3*this.Ys>=this.getTime()){var b=Math.floor(this.getTime()/1E3),c=Math.floor(Math.max(this.getTime()-a,0)/1E3);b!==c&&(b=this.sl,b.fc.r=0,b.fc.yo=!0,b.font.setFillColor(b.fc.color),b.xe(),"undefined"!==typeof a_gameui_timewarning_second&&H.play(a_gameui_timewarning_second))}this.setTime(Math.max(this.getTime()-a,0))}Rg.prototype.wa.apply(this,arguments);this.ur+=a};
e.Fj=function(a,b){this.Jc&&(this.Jc instanceof x?this.Jc.ed(0,a+this.Vi,b+this.Wi,1):this.Jc.ed(a+this.Vi,b+this.Wi,1));Rg.prototype.Fj.apply(this,arguments);this.zm&&this.Jc&&pa(a,b,this.Jc.width,this.Jc.height,"blue",!0)};
function ih(a,b,c,d,g,h){this.d=a;this.width=g;this.height=h;this.Na=null;this.x=c;this.y=d;this.visible=!0;this.a=b;this.alpha=void 0!==b.alpha?b.alpha:1;this.scale=void 0!==b.scale?b.scale:1;this.J={};this.J.wb=0;this.J.xb=0;this.J.scale=this.scale;this.J.alpha=this.alpha;this.J.Qa=0;this.B={};this.B.Qd=!1;this.B.origin={};this.B.target={};this.B.r=0;this.a.Jj&&(jh(this,this.a.Jj),this.B.Qd=!1);this.d.mc.push(this);kh||(kh={cb:function(a){a.value instanceof y?a.Na=a.value:(a.f=a.value,a.ob=0)},
update:Z.Gd,sb:Z.Ed,end:Z.Fd,gd:M,hd:M,fd:function(a,b,c,d){return 1-N(a,b,c,d)},hq:function(a,b,c,d){return 1*N(a,b,c,d)+1},iq:function(a,b,c,d){return 1*N(a,b,c,d)+1}})}var kh;
function jh(a,b){a.B.origin.x=void 0===b.x?a.x:b.x;a.B.origin.y=void 0===b.y?a.y:b.y;a.B.origin.alpha=void 0!==b.alpha?b.alpha:1;a.B.origin.scale=void 0!==b.scale?b.scale:1;a.B.target.x=a.x;a.B.target.y=a.y;a.B.target.alpha=a.alpha;a.B.target.scale=a.scale;a.B.duration=b.duration;a.B.Qd=!0;a.B.je=b.je||N;a.B.r=0;a.B.va=b.va||0;lh(a)}
function lh(a){a.B.r>=a.B.duration&&(a.B.r=a.B.duration,a.B.Qd=!1);var b=a.B.je(a.B.r,a.B.origin.x,a.B.target.x-a.B.origin.x,a.B.duration),c=a.B.je(a.B.r,a.B.origin.y,a.B.target.y-a.B.origin.y,a.B.duration);a.J.wb=b-a.x;a.J.xb=c-a.y;a.J.alpha=a.B.je(a.B.r,a.B.origin.alpha,a.B.target.alpha-a.B.origin.alpha,a.B.duration);a.J.scale=a.B.je(a.B.r,a.B.origin.scale,a.B.target.scale-a.B.origin.scale,a.B.duration);a.d.Fb=!0}e=ih.prototype;
e.bb=function(a,b){this.Na&&this.Na.oa(this.x+this.J.wb+a,this.y+this.J.xb+b,this.J.scale,this.J.scale,0,this.J.alpha)};e.Yj=function(a,b){mh(this.x+this.J.wb+a,this.y+this.J.xb+b,this.width*this.J.scale,this.height*this.J.scale)};e.jk=function(a,b){return a>this.x+this.J.wb&&a<this.x+this.J.wb+this.width*this.J.scale&&b>this.y+this.J.xb&&b<this.y+this.J.xb+this.height*this.J.scale};e.gs=function(a){this.visible!==a&&(this.visible=a,this.d.Fb=!0)};
e.wa=function(a){this.B.Qd&&(0<this.B.va?this.B.va-=a:(this.B.r+=-this.B.va,this.B.va=0,this.B.r+=a,lh(this)))};function $g(a,b){this.Vc=this.value=this.fk=b}$g.prototype.Hf=function(a){this.value=a};$g.prototype.W=function(){return this.value};$g.prototype.es=function(){};
function Tg(a,b){this.Sn=b;this.a={};for(var c in b)this.a[c]=b[c];this.f=this.a.f;this.L=0;this.Ze=this.a.Ze;this.a.Bo&&(this.a.x+=this.f.zb,this.a.y+=this.f.Ab);ih.call(this,a,this.a,this.a.x,this.a.y,this.f?this.f.width:1,this.f?this.f.height:1)}kf(ih,Tg);eh.GameUIImage=Tg;function nh(a,b){a.L!==b&&(a.L=b,a.d.Fb=!0)}e=Tg.prototype;
e.bb=function(a,b){this.f&&(this.Ze&&(a+=-Math.floor(this.f.width/2),b+=-Math.floor(this.f.height/2)),this.f instanceof x?this.f.oa(this.L,this.x+a+this.J.wb,this.y+b+this.J.xb,this.J.scale,this.J.scale,0,this.J.alpha):this.f.oa(this.x+a+this.J.wb,this.y+b+this.J.xb,this.J.scale,this.J.scale,0,this.J.alpha),this.d.zm&&pa(this.x+a-this.f.zb+1,this.y+b-this.f.Ab+1,this.f.width-2,this.f.height-2,"black",!0))};
e.jk=function(a,b){if(!this.f)return!1;var c=0,d=0;this.Ze&&(c+=-Math.floor(this.f.width/2),d+=-Math.floor(this.f.height/2));c-=this.f.zb;d-=this.f.Ab;return a>c+this.x+this.J.wb&&a<c+this.x+this.J.wb+this.width*this.J.scale&&b>d+this.y+this.J.xb&&b<d+this.y+this.J.xb+this.height*this.J.scale};e.Yj=function(a,b){this.f&&(this.Ze&&(a+=-Math.floor(this.f.width/2),b+=-Math.floor(this.f.height/2)),a-=this.f.zb,b-=this.f.Ab,mh(this.x+this.J.wb+a,this.y+this.J.xb+b,this.width*this.J.scale,this.height*this.J.scale))};
e.md=function(a){a||(a=new p(0,0));a.x=this.x+O.pf+this.d.wb;a.y=this.y+O.me+this.d.xb;return a};e.es=function(a){a!==this.f&&(this.f=a,this.d.Fb=!0,this.f&&(this.width=this.f.width,this.height=this.f.height))};e.Dq=function(){return this.f};
function Ug(a,b,c){"object"===typeof b&&(c=b,b=c.N?O.l.K(c.N,"<"+c.N+">"):c.text||"");this.text=b;this.font=c.font.M();c.Id&&C(this.font,c.Id);this.Qr=c.x;this.Rr=c.y;this.Pr=c.pb;this.lw=this.font.fillColor;this.Zc=void 0===c.Zc?.2:c.Zc;ih.call(this,a,c,Math.floor(c.x-.1*c.pb),Math.floor(c.y-.1*c.tb),Math.floor(1.2*c.pb),Math.floor(1.2*c.tb));this.Na=new y(this.width,this.height);switch(this.font.align){case "left":this.Qf=Math.floor(.1*c.pb);break;case "right":this.Qf=Math.floor(1.1*c.pb);break;
case "center":this.Qf=Math.floor(.6*c.pb);break;default:throw"Unknown alignment: "+this.font.align;}a=Math.floor(this.Zc*this.font.fontSize);switch(this.font.h){case "top":this.Rf=Math.floor(.1*c.tb);break;case "bottom":this.Rf=Math.floor(1.1*c.tb)+a;break;case "middle":this.Rf=Math.floor(.6*c.tb)+a;break;default:throw"Unknown baseline: "+this.font.h;}this.fc={};this.fc.color="red";this.fc.duration=200;this.fc.r=0;this.fc.yo=!1;this.xe()}kf(ih,Ug);eh.GameUIText=Ug;
Ug.prototype.wa=function(a){ih.prototype.wa.apply(this,arguments);this.fc.yo&&(this.fc.r+=a,this.fc.duration<=this.fc.r&&(this.fc.yo=!1,this.font.setFillColor(this.lw),this.xe()))};
Ug.prototype.xe=function(){this.Na.clear();z(this.Na);var a=this.font.da(this.text),b=1;a>this.Pr&&(b=this.Pr/a);this.font.oa(this.text,this.Qf,this.Rf,b,b,0,1);this.d.zm&&(pa(0,0,this.Na.width,this.Na.height,"black",!0),pa(this.Qr-this.x,this.Rr-this.y,this.Na.width-2*(this.Qr-this.x),this.Na.height-2*(this.Rr-this.y),"red",!0),qa(this.Qf-5,this.Rf,this.Qf+5,this.Rf),qa(this.Qf,this.Rf-5,this.Qf,this.Rf+5));this.d.Fb=!0;B(this.Na)};function oh(a){return""+a}function ph(a,b,c){return b+c}
function Zg(a,b,c,d,g,h){this.value=this.fk=d||0;this.Bl=-1;this.rt=c;this.a=b;this.qt=-99999;this.Go=b.Go||0;this.Nj=b.Nj?b.Nj:h||oh;c=ph;g&&0!==this.a.gq&&(c=cc);this.Ga=new lf(this.fk,void 0===this.a.gq?500:this.a.gq,c);b.Qh&&(this.Qh="game_ui_"+b.Qh);this.text=qh(this)+this.Nj(this.fk);Ug.call(this,a,this.text,b)}kf(Ug,Zg);eh.GameUIValue=Zg;Zg.prototype.Hf=function(a){this.value=a;nf(this.Ga,this.value)};Zg.prototype.W=function(){return this.value};
Zg.prototype.So=function(a){var b=this.Bl;if(a||I.le-this.qt>this.Go)b=this.Nj(Math.floor(this.Ga.W()));this.Bl!==b&&(this.qt=I.le,this.Bl=b,this.text=qh(this)+b,this.xe())};Zg.prototype.wa=function(a){Ug.prototype.wa.apply(this,arguments);mf(this.Ga,a);Math.floor(this.Ga.W())!==this.Bl&&this.So()};function qh(a){var b="";a.a.Oi&&(b=a.Qh?O.l.K(a.Qh,"<"+a.Qh.toUpperCase()+">"):O.l.K("game_ui_"+a.rt,"<"+a.rt+">"));return b+(a.a.separator?a.a.separator:"")}
function bh(a,b){this.fm=this.Vc=0;this.a=b;this.zi=this.Df=0;this.f=b.f;this.ge=b.ge||b.f;this.rn=b.rn||null;this.a.Kk=this.a.Kk||0;this.a.Lk=this.a.Lk||0;this.Zl=!0;this.Yk=b.Yk||0;this.H=[];this.Ga=new lf(0,200,gc);this.qc=new lf(0,200,gc);ih.call(this,a,b,b.x,b.y,this.f.width,this.f.height)}kf(ih,bh);eh.GameUIProgress=bh;
bh.prototype.wa=function(a){mf(this.Ga,a);var b=this.Ga.W();b!==this.Df&&(this.d.Fb=!0,this.Df=b);mf(this.qc,a);a=this.qc.W();a!==this.zi&&(this.d.Fb=!0,this.zi=a);b+=a;if(this.Zl)for(a=0;a<this.H.length;++a){var c=b>=this.H[a].position&&this.Vc+this.fm>=this.H[a].position;this.H[a].complete!==c&&(this.a.H&&(this.d.Fb=!0,this.Df=b),this.H[a].complete=c)}};
bh.prototype.bb=function(a,b){var c,d,g;if(0===this.Yk&&(0<this.qc.W()&&this.ge.ra(0,this.width*this.Ga.W()/100,0,this.ge.width*this.qc.W()/100,this.ge.height,a+this.x+this.width*this.Ga.W()/100,b+this.y),this.f.ra(0,0,0,this.width*this.Ga.W()/100,this.height,a+this.x,b+this.y),this.a.H))for(c=0;c<this.H.length;++c)d=this.H[c],g=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,g.u(0,a+this.x+this.width/100*d.position,b+this.y+this.a.H.y);if(1===this.Yk&&(0<this.qc.W()&&this.ge.ra(0,0,this.height-
this.height*this.Ga.W()/100,this.width,this.height,a+this.x,b+this.y+(this.height-this.height*this.Ga.W()/100)),this.f.ra(0,0,this.height-this.height*this.Ga.W()/100,this.width,this.height,a+this.x,b+this.y+(this.height-this.height*this.Ga.W()/100)),this.a.H))for(c=0;c<this.H.length;++c)d=this.H[c],g=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,g.u(0,a+this.x+this.a.H.x,b+this.y+this.height-this.height/100*d.position);if(2===this.Yk&&(0<this.qc.W()&&this.ge.ra(0,0,this.height*this.Ga.W()/
100,this.ge.width,this.ge.height*this.qc.W()/100,a+this.x+this.width*this.Ga.W()/100,b+this.y),this.f.ra(0,0,0,this.width,this.height*this.Ga.W()/100,a+this.x,b+this.y),this.a.H))for(c=0;c<this.H.length;++c)d=this.H[c],g=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,g.u(0,a+this.x+this.a.H.x,b+this.y+this.height/100*d.position);this.rn&&this.rn.u(0,a+this.x+this.a.Kk,b+this.y+this.a.Lk)};function fh(a,b,c){this.vl=!1;this.Ki=-1;this.d=a;this.a=b;this.i=!0;this.no(c);Tg.call(this,a,b)}
kf(Tg,fh);eh.GameUIButton=fh;fh.prototype.no=function(a){var b=null,c=null,d=this.d,g=this.a;void 0===a&&(a=g.Y?g.Y:0);switch(a){case 0:b=d.Eg.Pm?Gd:Hd;c=function(){Ff(O.d)?O.d.Rd(!1,!0,d.Eg.Pm):O.d.Rd();return!0};break;case 1:b=Id;c=function(){O.d.Rd();return!0};break;case 2:b=s_btn_small_quit;c=function(){rh(d.Eg.Pm);return!0};break;case 3:b=g.f}this.Lb=c;this.a.f=b};fh.prototype.ub=function(a,b,c){if(this.i)return this.jk(b-O.pf,c-O.me)?(this.vl=!0,this.Ki=a,nh(this,1),!0):!1};
fh.prototype.wa=function(a){Tg.prototype.wa.apply(this,arguments);this.vl&&(this.jk(Bb(this.Ki)-O.pf,I.na[this.Ki].y-O.me)?nh(this,1):nh(this,0))};fh.prototype.Cb=function(a,b,c){return this.vl&&a===this.Ki?(nh(this,0),this.jk(b-O.pf,c-O.me)&&this.Lb&&this.Lb(),this.vl=!1,this.Ki=-1,!0):!1};
function ah(a,b){this.fm=this.Vc=0;this.a=b;this.zi=this.Df=0;this.Zl=!0;this.H=[];this.color=b.color||"#00AEEF";this.Jp=b.Jp||"#FF0F64";this.Ip=b.Ip||"#FFED93";this.$t=void 0===b.blink||b.blink;this.Bc=b.Bc;this.Fh=!1;this.Ve=0;this.oj=1E3;this.pj=0;this.Ga=new lf(0,200,gc);this.qc=new lf(0,200,gc);ih.call(this,a,b,b.x,b.y,1,1)}kf(ih,ah);eh.GameUIRoundProgress=ah;
ah.prototype.wa=function(a){mf(this.Ga,a);var b=this.Ga.W();b!==this.Df&&(this.d.Fb=!0,this.Df=b);mf(this.qc,a);var c=this.qc.W();c!==this.zi&&(this.d.Fb=!0,this.zi=c);this.Fh&&(this.Ve+=a,this.Ve>=this.oj?100===this.Vc?(this.Fh=!1,this.$t&&(this.Fh?this.Ve-=this.oj:(this.Fh=!0,this.pj=this.Ve=0,nf(this.Ga,100)))):(this.Fh=!1,this.pj=0,this.Ga.og=0,this.Ga.tl=0,nf(this.Ga,this.Vc)):this.pj=(-Math.cos(this.Ve/this.oj*5*Math.PI*2)+1)/2,this.d.Fb=!0);b+=c;if(this.Zl)for(a=0;a<this.H.length;++a)c=b>=
this.H[a].position&&this.Vc+this.fm>=this.H[a].position,this.H[a].complete!==c&&(this.a.H&&(this.d.Fb=!0,this.Df=b),this.H[a].complete=c)};ah.prototype.Yj=function(a,b){this.Bc&&mh(this.x+this.J.wb+a-this.Bc.zb,this.y+this.J.xb+b-this.Bc.Ab,this.Bc.width*this.J.scale,this.Bc.height*this.J.scale)};
ah.prototype.bb=function(a,b){var c,d;if(this.Bc){d=this.Ga.W()/100;d=Math.max(d,0);d=Math.min(d,1);var g=w.context,h=this.Bc.width/2-P(4),k=g.fillStyle;if(0<this.qc.W()){var l=this.qc.W()/100;g.beginPath();g.arc(this.x+a,this.y+b,h,.5*-Math.PI+2*d*Math.PI,2*(d+l)*Math.PI-.5*Math.PI,!1);g.lineTo(this.x+a,this.y+b);g.fillStyle=this.Jp;g.fill()}g.beginPath();g.arc(this.x+a,this.y+b,h,.5*-Math.PI,2*d*Math.PI-.5*Math.PI,!1);g.lineTo(this.x+a,this.y+b);g.fillStyle=this.color;g.fill();this.oj&&(l=g.globalAlpha,
g.globalAlpha*=this.pj,g.beginPath(),g.arc(this.x+a,this.y+b,h,.5*-Math.PI,2*d*Math.PI-.5*Math.PI,!1),g.lineTo(this.x+a,this.y+b),g.fillStyle=this.Ip,g.fill(),g.globalAlpha=l);if(this.a.H){var l=g.strokeStyle,n=g.lineWidth;g.strokeStyle="white";g.lineWidth=P(2);for(d=0;d<this.H.length;++d){c=this.H[d];c=c.position/100*Math.PI*2;var q=Math.cos(-.5*Math.PI+c)*h;c=Math.sin(-.5*Math.PI+c)*h;g.beginPath();g.moveTo(Math.round(a+this.x),Math.round(b+this.y));g.lineTo(Math.round(a+this.x+q),Math.round(b+
this.y+c));g.stroke()}g.strokeStyle=l;g.lineWidth=n}this.Bc.u(0,a+this.x,b+this.y);if(this.a.H)for(d=0;d<this.H.length;++d)c=this.H[d],h=c.complete?s_star_filled:s_star_empty,c=c.position/100*Math.PI*2,h.u(0,Math.round(a+this.x+Math.cos(-.5*Math.PI+c)*this.a.H.Gw*.5),Math.round(b+this.y+Math.sin(-.5*Math.PI+c)*this.a.H.Gw*.5));g.fillStyle=k}};O.version=O.version||{};O.version.game_ui="2.1.0";
var Pg=P(14),Qg=P(40),Og={},sh={background:{f:fd,Uq:P(0),Vq:P(34),elements:[{f:hd,x:P(46)+Pg,y:P(16)+Qg},{N:"game_ui_time_left",x:P(6)+Pg,y:P(52)+Qg,pb:P(100),tb:P(20),Zc:.2,font:V,Id:{fillColor:"#9fa9bf",fontSize:P(20),Oc:"lower",align:"center",h:"top"}},{f:ed,x:P(9,"round")+Pg,y:P(124)+Qg},{N:"game_ui_SCORE",x:P(6)+Pg,y:P(140)+Qg,pb:P(100),tb:P(20),Zc:.2,font:V,Id:{fillColor:"#9fa9bf",fontSize:P(20),Oc:"lower",align:"center",h:"top"}},{f:ed,x:P(9,"round")+Pg,y:P(200)+Qg},{N:"game_ui_HIGHSCORE",
x:P(6)+Pg,y:P(258)+Qg,pb:P(100),tb:P(20),Zc:.2,font:V,Id:{fillColor:"#9fa9bf",fontSize:P(20),Oc:"lower",align:"center",h:"top"}},{f:ed,x:P(9,"round")+Pg,y:P(318)+Qg}]},Tr:{x:P(6)+Pg,y:P(538)-P(86)+Qg},time:{x:P(6)+Pg,y:P(80)+Qg,pb:P(100),tb:P(38),Zc:.2,Oi:!1,separator:"",font:V,Id:{fontSize:P(38),fillColor:"#172348",align:"center",h:"top"}},R:{x:P(6)+Pg,y:P(166)+Qg,pb:P(100),tb:P(24),Go:50,Zc:.2,Oi:!1,separator:"",font:V,Id:{fontSize:P(24),fillColor:"#172348",align:"center",h:"top"}},Sq:{x:P(43,"round")+
Pg,y:P(212)+Qg,f:gd,Ze:!1,Bo:!0},Pq:{x:P(6)+Pg,y:P(284)+Qg,pb:P(100),tb:P(20),Zc:.2,Oi:!1,separator:"",font:V,Id:{fillColor:"#59668e",fontSize:P(20),align:"center",h:"top"}},Rh:{x:P(6)+Pg,y:P(362)+Qg,pb:P(100),tb:P(40),Zc:.2,Oi:!1,separator:"",font:V,Id:{fillColor:"#9fa9bf",fontSize:P(20),align:"center",h:"top",Oc:"lower"}},df:{x:P(56)+Pg,y:P(340)+Qg,f:kd,Ze:!1,Bo:!1}},Yg=sh,Z={Os:{},Ps:{},Qs:{},Rs:{},On:{},Pn:{},wx:{},av:{},Ht:function(){Z.Os={cb:Z.zj,update:Z.Gd,sb:Z.Ed,end:Z.Fd,font:se,margin:20,
gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.Ps={cb:Z.zj,update:Z.Gd,sb:Z.Ed,end:Z.Fd,font:te,margin:20,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.Qs={cb:Z.zj,update:Z.Gd,sb:Z.Ed,end:Z.Fd,font:ue,margin:20,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.Rs={cb:Z.zj,update:Z.Gd,sb:Z.Ed,end:Z.Fd,font:ve,margin:20,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.On={cb:Z.hu,update:Z.Gd,sb:Z.Ed,end:Z.Fd,Yh:we,Xh:xe,margin:20,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.Pn={cb:Z.iu,
update:Z.Gd,sb:Z.Ed,end:Z.Fd,Yh:we,Xh:xe,margin:20,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.wx={cb:Z.ju,update:Z.Gd,sb:Z.Ed,end:Z.Fd,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])};Z.av={cb:Z.gu,update:Z.Gd,sb:Z.Ed,end:Z.Fd,gd:M,hd:M,fd:ic([N,Yb,N],[!1,!1,!0],[.1,.8,.1])}},xy:function(a){function b(a){var d,g={};for(d in a)g[d]="object"===typeof a[d]&&null!==a[d]?b(a[d]):a[d];return g}return b(a)},HA:function(a){Z.Os.font.O=a;Z.Ps.font.O=a;Z.Qs.font.O=a;Z.Rs.font.O=a},GA:function(a){Z.On.Yh.O=
a;Z.On.Xh.O=a;Z.Pn.Yh.O=a;Z.Pn.Xh.O=a},Yg:!1,Ub:[],Ow:function(a){Z.Yg=a},az:function(){return Z.Yg},Jw:function(a){var b,c;for(b=0;b<Z.Ub.length;b+=1)c=Z.Ub[b],void 0===c||void 0!==a&&c.kind!==a||0<c.Dg||(Z.Ub[b]=void 0)},Gt:function(){Z.Yg=!1;Z.Ub=[]},$g:function(a,b,c,d){var g,h,k;void 0===d&&(d=Z.Yg);if(d)for(h=0;h<Z.Ub.length;h+=1)if(g=Z.Ub[h],void 0!==g&&g.pe&&g.kind===a&&g.font===b&&g.text===c)return g.Dg+=1,h;g={kind:a,font:b,text:c,Dg:1,pe:d};h=b.align;k=b.h;F(b,"center");G(b,"middle");d=
b.da(c)+2*a.margin;a=b.V(c)+2*a.margin;g.Na=new y(d,a);z(g.Na);b.u(c,d/2,a/2);B(g.Na);F(b,h);G(b,k);for(h=0;h<Z.Ub.length;h+=1)if(void 0===Z.Ub[h])return Z.Ub[h]=g,h;Z.Ub.push(g);return Z.Ub.length-1},Et:function(a){var b=Z.Ub[a];b.Dg-=1;0>=b.Dg&&!b.pe&&(Z.Ub[a]=void 0)},zj:function(a){a.buffer=Z.$g(a.kind,a.kind.font,a.value,a.pe)},hu:function(a){var b=a.value.toString();a.buffer=0<=a.value?Z.$g(a.kind,a.kind.Yh,b,a.pe):Z.$g(a.kind,a.kind.Xh,b,a.pe)},iu:function(a){var b=a.value.toString();0<a.value&&
(b="+"+b);a.buffer=0<=a.value?Z.$g(a.kind,a.kind.Yh,b,a.pe):Z.$g(a.kind,a.kind.Xh,b,a.pe)},ju:function(a){a.Na=a.value},gu:function(a){a.f=a.value;a.ob=0},Gd:function(a){a.x=void 0!==a.kind.gd?a.kind.gd(a.time,a.il,a.lq-a.il,a.duration):a.il+a.time/a.duration*(a.lq-a.il);a.y=void 0!==a.kind.hd?a.kind.hd(a.time,a.jl,a.mq-a.jl,a.duration):a.jl+a.time/a.duration*(a.mq-a.jl);void 0!==a.kind.hq&&(a.Ef=a.kind.hq(a.time,0,1,a.duration));void 0!==a.kind.iq&&(a.Ff=a.kind.iq(a.time,0,1,a.duration));void 0!==
a.kind.fd&&(a.alpha=a.kind.fd(a.time,0,1,a.duration));void 0!==a.kind.ru&&(a.Qa=a.kind.ru(a.time,0,360,a.duration)%360);void 0!==a.f&&(a.ob=a.time*a.f.L/a.duration)},Ed:function(a){var b=w.context,c;void 0!==a.f&&null!==a.images?1===a.Ef&&1===a.Ff&&0===a.Qa?a.f.ed(Math.floor(a.ob),a.x,a.y,a.alpha):a.f.oa(Math.floor(a.ob),a.x,a.y,a.Ef,a.Ff,a.Qa,a.alpha):(c=void 0!==a.Na&&null!==a.Na?a.Na:Z.Ub[a.buffer].Na,1===a.Ef&&1===a.Ff&&0===a.Qa?c.ed(a.x-c.width/2,a.y-c.height/2,a.alpha):1E-4>Math.abs(a.Ef)||
1E-4>Math.abs(a.Ff)||(b.save(),b.translate(a.x,a.y),b.rotate(-a.Qa*Math.PI/180),b.scale(a.Ef,a.Ff),c.ed(-c.width/2,-c.height/2,a.alpha),b.restore()))},Fd:function(a){void 0!==a.buffer&&Z.Et(a.buffer)},od:function(a){var b,c,d=!1;for(b=0;b<Z.qb.length;b+=1)c=Z.qb[b],void 0!==c&&(0<c.va?(c.va-=a,0>c.va&&(c.time+=-c.va,c.va=0)):c.time+=a,0<c.va||(c.time>=c.duration?(c.kind.end(c),Z.qb[b]=void 0):c.kind.update(c),d=!0));d&&(Z.canvas.$=!0)},bb:function(){var a,b;for(a=0;a<Z.qb.length;a+=1)b=Z.qb[a],void 0!==
b&&(0<b.va||b.kind.sb(b))},qb:[],ev:function(a,b,c){Z.kq();void 0===a&&(a=O.qg);void 0===b&&(b=-1E6);void 0===c&&(c=["game"]);Z.visible=!0;Z.i=!0;O.b.Za(Z,a);Z.depth=b;J(Z);Mb(Z,c);Z.Gt();Z.Ht()},$x:function(a,b,c,d,g,h,k,l,n){void 0===l&&(l=void 0!==a.va?a.va:0);void 0===n&&(n=Z.Yg);void 0===g&&void 0!==a.bw&&(g=c+a.bw);void 0===h&&void 0!==a.cw&&(h=d+a.cw);void 0===k&&void 0!==a.duration&&(k=a.duration);a={kind:a,value:b,il:c,jl:d,lq:g,mq:h,x:c,y:d,Ef:1,Ff:1,alpha:1,Qa:0,time:0,duration:k,va:l,
pe:n};a.kind.cb(a);for(b=0;b<Z.qb.length;b+=1)if(void 0===Z.qb[b])return Z.qb[b]=a,b;Z.qb.push(a);return Z.qb.length-1},nA:function(a){var b;0>a||a>=Z.qb.length||(b=Z.qb[a],void 0!==b&&(b.kind.end(b),Z.qb[a]=void 0))},Iw:function(){var a,b;for(a=0;a<Z.qb.length;a+=1)b=Z.qb[a],void 0!==b&&(b.kind.end(b),Z.qb[a]=void 0);Z.qb=[]},kq:function(){Z.Iw();Z.Jw();K(I,Z)}};
function $(a,b,c,d){this.ya=this.depth=0;this.visible=!1;this.i=!0;this.Fe=a;this.rd=b;this.open=!1;this.x=void 0===c?0:c;this.y=void 0===d?0:d;this.Pj=this.x;this.Qj=this.y;this.ol=this.x;this.pl=this.y;this.alpha=1;this.bs=O.a.j.mm.shadowOffsetX/2;this.cs=O.a.j.mm.shadowOffsetY/2;this.xq=this.Wc=0;this.gv=!1;this.Eo=this.Ge=0;this.Ms=this.Ns=N;this.Wg=0;this.Cl=2500;this.Wx=O.Ju/2;this.xt=!1;this.Ca=this.Aa=1;this.Jm=this.jf=0;this.ls=!1;this.yu=function(a){return.1>a?ac(a,1,1.3-1,.2):.2>a?1.3:
.45>a?ac(a-.2,1.3,-1.2,.2):.7>a?$b(a-.45,.1,1.2,.2):.8>a?1.3:$b(a-.8,1.3,-(1.3-1),.2)};this.zu=ic([ac,Yb,ac],[!1,!1,!0],[.1,.7,.2]);this.Xw=ic([ac,ac],[!1,!0]);this.fi=!0;J(this);Mb(this,["game","item"]);O.b.Za(this,O.qg)}e=$.prototype;e.Dq=function(){return this.open===this.fi?{f:T,Gs:13*this.Fe+this.rd-1}:{f:Zd,Gs:0}};
function th(a,b,c,d,g){void 0===b&&(b=0);void 0===c&&(c=0);a.jf=b+c;a.Jm=b;a.open=!a.open;a.fi=!1;a.ls=void 0===g?!1:g;a.i=!0;if(void 0===c||0===c)a.visible=!0;void 0===d&&(d=!1);void 0===a.Zb||d||a.Zb.Nb()}
e.wa=function(a){var b=1,b=1;this.i=!1;0<this.Ge?(this.i=!0,this.Ge-=a,this.Ge>this.Eo?b=0:(this.visible=!0,b=0>=this.Ge?1:1-this.Ge/this.Eo),b=this.Ms(b,0,1,1),this.x=this.Pj+(this.ol-this.Pj)*b,this.y=this.Qj+(this.pl-this.Qj)*b,this.gv?(this.Wc+=(1-this.Wc)/2*a/12,this.Wc=Math.min(this.Wc,1)):this.Wc=this.xq*(1-b)):(this.x=this.ol,this.y=this.pl);0<this.jf?(this.i=!0,this.jf-=a,this.jf>this.Jm?b=0:(this.visible=!0,b=0>=this.jf?1:1-this.jf/this.Jm),!this.fi&&.45<b&&(this.fi=!0,H.play(Ie)),this.ls?
(b=this.Xw(b,0,1,1),this.Aa=1-.99*b,this.Ca=1+.2*b):(this.Aa=this.yu(b),this.Ca=this.zu(b,1,.3,1))):this.fi=!0;if(this.xt)if(this.Wg+=a,this.Wg>=this.Cl)this.i=this.xt=!1;else{this.i=!0;this.x=this.Pj+N(this.Wg,0,-this.Wx,this.Cl);a=this.Qj;var c=this.Cl,b=O.Cu,d=c-this.Wg,g=2,h=5,k,l,n;void 0===g&&(g=4);h=void 0===h?2:Math.sqrt(h);k=[1];for(l=n=1;l<g;l+=1)k.push(k[l-1]*h),n+=k[l];n-=k[g-1]/2;h=Math.pow(k[g-1],2);d=d/c*n;for(l=c=0;l<g;l+=1)if(d>k[l])d-=k[l];else{c=k[l];break}this.y=a+(0+b*(1+-1*(-4*
Math.pow(d-c/2,2)+c*c)/h));this.alpha=dc(this.Wg,1,-1,this.Cl)}!1===this.i&&(this.visible=!1,void 0!==this.Zb&&this.Zb.Nb())};e.od=function(){this.canvas.$=!0};e.bb=function(){w.context.save();w.context.translate(this.x-2*this.bs*this.Wc,this.y-2*this.cs*this.Wc);w.context.scale(this.Aa,this.Ca);pd.oa(0,2*this.bs*this.Wc,2*this.cs*this.Wc,1,1,0,this.alpha);this.Nb(0,0);w.context.restore()};
e.Nb=function(a,b){var c=this.Dq();c.f.oa(c.Gs,a,b,1,1,0,this.alpha);O.a.j.debug.ou&&w.context.fillText("s"+this.Fe+"c"+this.rd,a+4,b-T.height/3)};e.nd=function(){return new Rect(this.x-T.width/2,this.y-T.height/2,T.width,T.height)};function Rect(a,b,c,d){this.x=a;this.y=b;this.width=c;this.height=d}Rect.prototype.contains=function(a,b){return a>=this.x&&a<=this.x+this.width&&b>=this.y&&b<=this.y+this.height};
Rect.prototype.Bm=function(a){return new Rect(this.x-a,this.y-a,this.width+2*a,this.height+2*a)};function uh(a,b,c){b<a.x?(a.width=a.x-b+a.width,a.x=b):b>a.x+a.width&&(a.width=b-a.x);c<a.y?(a.height=a.y-c+a.height,a.y=c):c>a.y+a.height&&(a.height=c-a.y)}function vh(a){return[new p(a.x,a.y),new p(a.x+a.width,a.y),new p(a.x,a.y+a.height),new p(a.x+a.width,a.y+a.height)]}
function wh(a,b,c){this.x=a;this.y=b;this.Yr=c;this.p=[];this.Di="squared";this.Ya=-1;this.kd=new p(0,20);this.rq=.5;this.Ep=0;this.Mk=this.Nk="none";this.rk=-1;this.nj=0;this.sb=!0}
function xh(a,b,c){if("alternate"===a.Nk){if(null!==b&&(0===b.Fe||3===b.Fe?"black":"red")===(0===c.Fe||3===c.Fe?"black":"red"))return!1}else if("same"===a.Nk&&null!==b&&b.Fe!==c.Fe)return!1;if("asc"===a.Mk)if(null===b){if(1!==c.rd)return!1}else{if(b.rd+1!==c.rd)return!1}else if("desc"===a.Mk)if(null===b){if(!0===O.m.Kd.Wn&&13!==c.rd)return!1}else if(b.rd-1!==c.rd)return!1;return!0}
function yh(a,b){var c=0;if(0<=a.rk&&a.p.length+b.length>a.rk||!xh(a,zh(a),b[0]))return!1;for(c=0;c<b.length-1;c+=1)if(!xh(a,b[c],b[c+1]))return!1;a.p=a.p.concat(b);return!0}function zh(a){return 0===a.p.length?null:a.p[a.p.length-1]}function Ah(a,b){return 0<=a.rk&&a.p.length>=a.rk?!1:xh(a,zh(a),b)?(a.p.push(b),!0):!1}wh.prototype.pop=function(){return this.p.pop()};
wh.prototype.md=function(a){var b,c=new p(this.x,this.y),d;if("fanned"===this.Di&&(b=0<=this.Ya?Math.max(0,this.p.length-this.Ya):0,a>=b))for(d=b;d<a;d+=1)b=this.p[d].open?1:this.rq,c=c.add(this.kd.scale(b));return c};wh.prototype.nd=function(a){a=this.md(a);return new Rect(a.x-T.width/2*1,a.y-T.height/2*1,1*T.width,1*T.height)};
function Bh(a){var b,c,d;return"fanned"===a.Di?(b=a.nd(0),c=new Rect(b.x,b.y,b.width,b.height),-1===a.Ya?(0<a.kd.x?c.x+=w.width:0>a.kd.x&&(c.x-=w.width),0<a.kd.y?c.y+=w.height:0>a.kd.y&&(c.y-=w.height)):(d=Math.max(a.Ya,a.Ep),c.x+=a.kd.x*d,c.y+=a.kd.y*d),uh(b,c.x,c.y),uh(b,c.x+c.width,c.y+c.height),b.Bm(1)):a.nd(0).Bm(1)}
function Ch(a,b,c,d,g,h,k){var l,n,q,v;void 0===c&&(c=0);void 0===d&&(d=0);void 0===h&&(h=0);void 0===k&&(k=!1);for(l=0;l<a.p.length;l+=1){q=l>=d;n=h+Math.max(0,l-d)*c;v=b;!q&&k&&(n=0,v*=2);var D=a,A=l,r=v,s=n;n=g;var t=D.nj-A,u=D.md(A);void 0===s&&(s=0);A=D.p[A];v=u.x;u=u.y;A.Pj=A.x;A.Qj=A.y;A.ol=v;A.pl=u;A.xq=A.Wc;void 0!==t&&Lb(A,t);if(!(!0!==q&&0>=A.Ge&&A.x===v&&A.y===u)){void 0===s&&(s=0);A.Ge=r+s;A.Eo=r;A.Ms=A.Ns;A.i=!0;if(void 0===s||0===s)A.visible=!0;void 0===n&&(n=!1);void 0===A.Zb||n||
A.Zb.Nb();A.Zb=D}}}wh.prototype.Nb=function(){var a,b,c;if(!0===this.sb){O.b.mb(O.mf);a=Bh(this);mh(a.x,a.y,a.width,a.height);O.a.j.debug.pu&&pa(a.x,a.y,a.width,a.height,"red",!0);void 0!==this.Yr&&(c=this.md(0),this.Yr.oa(0,c.x,c.y,1,1,0,1));if(this.$u)for(a=0;a<this.p.length;a+=1)b=this.p[a],c=this.md(a),b.x===c.x&&b.y===c.y&&pd.oa(0,c.x,c.y,1,1,0,1);for(a=0;a<this.p.length;a+=1)b=this.p[a],c=this.md(a),b.x!==c.x||b.y!==c.y||b.visible||b.Nb(Math.round(c.x),Math.round(c.y))}};
function Dh(a,b,c){this.depth=c;this.ya=0;this.i=this.visible=!0;this.x=a;this.y=b;this.ob=0;this.Cs=9;this.startTime=I.le;this.duration=O.a.j.mm.qu;J(this);Mb(this,["game","item"]);O.b.Za(this,O.qg)}Dh.prototype.bb=function(){var a=Math.floor((I.le-this.startTime)/this.duration*this.Cs);a>=this.Cs?K(I,this):ud.oa(a,this.x,this.y,1,1,0,1)};function Eh(){this.Cc=this.ke=this.la=this.Sb=void 0}
function Fh(a){var b=52,c,d,g;c=O.a.j.pd.Yp+O.nf;var h=O.a.j.pd.Zp+O.of;if(!0===a){a=[];for(d=0;4>d;d+=1)for(g=1;14>g;g+=1)a.push(new $(d,g,c,h));for(;b;)d=Math.floor(Math.random()*b),b-=1,c=a[b],a[b]=a[d],a[d]=c}else a=[new $(0,1,c,h),new $(1,1,c,h),new $(0,2,c,h),new $(1,2,c,h),new $(0,3,c,h),new $(1,3,c,h),new $(0,4,c,h),new $(1,4,c,h),new $(0,5,c,h),new $(1,5,c,h),new $(0,6,c,h),new $(1,6,c,h),new $(0,7,c,h),new $(1,7,c,h),new $(0,8,c,h),new $(1,8,c,h),new $(0,9,c,h),new $(1,9,c,h),new $(0,10,
c,h),new $(1,10,c,h),new $(0,11,c,h),new $(1,11,c,h),new $(0,12,c,h),new $(1,12,c,h),new $(3,13,c,h),new $(2,13,c,h),new $(2,12,c,h),new $(3,11,c,h),new $(2,11,c,h),new $(3,12,c,h),new $(3,9,c,h),new $(2,9,c,h),new $(3,10,c,h),new $(2,10,c,h),new $(2,6,c,h),new $(3,7,c,h),new $(2,7,c,h),new $(3,8,c,h),new $(2,8,c,h),new $(2,3,c,h),new $(3,4,c,h),new $(2,4,c,h),new $(3,5,c,h),new $(2,5,c,h),new $(3,6,c,h),new $(1,13,c,h),new $(0,13,c,h),new $(3,1,c,h),new $(2,1,c,h),new $(3,2,c,h),new $(2,2,c,h),new $(3,
3,c,h)];return a}function Gh(){var a=O.m.G,b;for(b=0;b<a.ke.length;b+=1)if(13!==a.ke[b].p.length)return!1;return!0}
Eh.prototype.cb=function(a){var b,c,d,g,h,k,l,n=Fh(!0!==a);b=7*O.a.j.pd.Vn;l=new wh(O.a.j.pd.Yp+O.nf,O.a.j.pd.Zp+O.of);l.p=[n[0]];a=new Vb;a.ua(b,function(){l.p=[];l.Nb()});a.start();Mb(a,["game","item"]);a=new wh(O.a.j.Sb.Bf+O.nf,O.a.j.Sb.Cf+O.of,qd);g=24;a.p=n.slice(0,g);Ch(a,O.a.j.pd.rx,O.a.j.pd.sx,void 0,void 0,b);a.nj=-104;a.lz=!0;b=new wh(O.a.j.la.Bf+O.nf,O.a.j.la.Cf+O.of,rd);b.Di="fanned";b.Ya=O.m.Kd.Wh;b.Ep=O.m.Kd.Wh;b.kd=new p(O.a.j.la.Lj,O.a.j.la.Mj);b.rq=1;b.nj=-52;b.cr=!0;c=[];for(h=0;4>
h;h+=1)d=new wh(O.a.j.Nm.Bf+h*(T.width+O.a.j.Nm.offset)+O.nf,O.a.j.Nm.Cf+O.of,td),d.Nk="same",d.Mk="asc",d.ik=!0,c.push(d);d=[];for(h=1;8>h;h+=1)k=new wh(O.a.j.Zb.Bf+(h-1)*(T.width+O.a.j.Zb.offset)+O.nf,O.a.j.Zb.Cf+O.of,sd),k.Di="fanned",k.Nk="alternate",k.Mk="desc",k.kd=new p(O.a.j.Zb.Lj,O.a.j.Zb.Mj),k.kz=!0,k.p=n.slice(g,g+h),g+=h,zh(k).open=!0,d.push(k),Ch(k,O.a.j.pd.pw,O.a.j.pd.Vn,void 0,void 0,(h-1)/7*O.a.j.pd.Vn);a.Nb();b.Nb();l.Nb();for(h=0;h<c.length;h+=1)c[h].Nb();for(h=0;h<d.length;h+=1)d[h].Nb();
n=H.play(Ge);H.fl(n,!0);H.stop(n,4E3,bc);this.Sb=a;this.la=b;this.ke=c;this.Cc=d};function Hh(){this.ya=this.depth=0;this.visible=!0;this.i=!1;this.Zn=0;this.ef=3600;this.Af=-1;this.Pk=0;this.Ok=void 0;this.wi=new p(0,0);this.ue=new p(0,0);this.et=[];this.ie=new Ih;J(this);Mb(this,["game","item"]);O.b.Za(this,O.qg)}
function Jh(a,b,c){var d=He;b!==c&&(!0===c.ik&&!0!==b.ik?(!0===b.cr&&a.R(O.m.R.yk),a.R(O.m.R.Ak),d=Le):!0===b.ik&&!0!==c.ik?a.R(O.m.R.Mn):!0===b.cr?a.R(O.m.R.yk):a.R(O.m.R.move));H.play(d)}e=Hh.prototype;e.R=function(a){var b=O.m.Ob,c=b.ze.W();b.eg(a);0>b.ze.W()&&gh(b,0);a=b.ze.W()-c;0<a&&this.ie.eg(a)};e.cb=function(){this.i=!0};function Kh(a,b){a.ef=Math.max(b,a.ef)}
function Lh(a){var b,c,d,g,h,k,l,n;g=[];n=O.m.G.la.Ya;if(0===O.m.G.Sb.p.length){if(O.m.Kd.Ao){h=O.a.j.kb.Jx;k=O.a.j.kb.Ix;l=.2*h;c=O.m.G.la.p.length;for(b=0;b<c;b+=1)d=O.m.G.la.pop(),th(d,h-2*l,l+b*k,void 0,!0),O.m.G.Sb.p.push(d),g.unshift(d);Mh(a.ie,O.m.G.la,O.m.G.Sb,g);Ch(O.m.G.Sb,h,k);Kh(a,k*(c-1)+h);a.R(O.m.R.co)}}else{h=O.a.j.kb.Mx;k=O.a.j.kb.Kx;l=O.a.j.kb.Lx;c=Math.min(O.m.G.Sb.p.length,O.m.Kd.Wh);O.m.G.la.Ya=c;for(b=0;b<c;b+=1)d=O.m.G.Sb.pop(),th(d,h,k*b,!0),Ah(O.m.G.la,d),g.unshift(d);Mh(a.ie,
O.m.G.Sb,O.m.G.la,g,!1,O.m.G.la.Ya-n);O.m.G.la.Nb();Ch(O.m.G.la,.5*h,k,O.m.G.la.p.length-c,!0,.2*h,!0);b=k*(c-1)+h;Kh(a,b);a.R(O.m.R.Im);a=new Vb;a.ua(b+l,function(){var a=zh(O.m.G.la);null!==a&&new Dh(a.ol,a.pl,a.depth+1)});a.ua(k*(c-1),function(){O.m.G.Sb.Nb()});a.start();Mb(a,["game","item"])}}function Nh(a){var b,c,d=O.m.G.Cc.concat(O.m.G.ke),g=[],h=[];for(b=0;b<a.length;b+=1)for(c=0;c<d.length;c+=1)!h[c]&&Bh(d[c]).contains(a[b].x,a[b].y)&&(g.push(d[c]),h[c]=!0);return g}
function Oh(a){0===a.ie.wj.length||a.et.push(a.ie);a.ie=new Ih}e.Mi=function(){Oh(this);var a=this.et.pop();a&&(a.Mi(),this.R(O.m.R.Qo))};
e.ub=function(a){var b;if(!(0<this.ef)&&-1===this.Af){this.Af=a;this.Pk=0;this.Ok=void 0;this.wi=new p(Bb(a),I.na[a].y);Oh(this);a:{a=this.wi.x;b=this.wi.y;var c,d,g,h=O.m.G.Cc.concat(O.m.G.ke);for(c=0;c<h.length;c+=1){b:{g=h[c];d=a;for(var k=b,l=void 0,l=g.p.length-1;0<=l;l-=1)if(g.nd(l).contains(d,k)){g=l;break b}g=0<g.p.length&&Bh(g).contains(d,k)?-1:-2}if(-2!==g){if(-1===g)g=h[c].p.length-1;else for(d=g;d<h[c].p.length;d+=1)if(h[c].p[d].open){g=d;break}b:{d=h[c];k=0;for(k=d.p.length-1;k>=g;k-=
1)if(!d.p[k].open||k<d.p.length-1&&!xh(d,d.p[k],d.p[k+1])){d=!1;break b}d=!0}if(d){a={lb:h[c],vj:g};break a}}}g=O.m.G.la.p.length-1;a=0<=g&&O.m.G.la.nd(g).contains(a,b)?{lb:O.m.G.la,vj:g,Om:!0}:void 0}void 0!==a&&(a.Qk=a.lb.md(a.vj),a.yb=new wh(a.Qk.x,a.Qk.y),a.yb.Di="fanned",a.yb.nj=-104,a.yb.sb=!1,a.yb.$u=!0,a.yb.p=a.lb.p.slice(a.vj),a.yb.kd=new p(O.a.j.Zb.Lj,O.a.j.Zb.Mj),a.lb.p=a.lb.p.slice(0,a.vj),!0===a.Om&&(b=a.lb.Ya,a.lb.Ya=Math.max(a.lb.Ya-1,0),a.xu=a.lb.Ya-b),Ch(a.yb,100));this.Ok=a}};
e.od=function(a){var b,c;this.canvas.$=!0;this.ef=Math.max(this.ef-a,0);0<this.ef||-1===this.Af||(this.Pk+=a,this.ue=new p(Bb(this.Af),I.na[this.Af].y),c=this.Ok,void 0!==c&&(b=da(this.ue,this.wi),c.yb.x=c.Qk.x+b.x,c.yb.y=c.Qk.y+b.y,Ch(c.yb,a)))};
e.Cb=function(a){var b,c,d,g=0,h,k=null,l,n,q=O.a.j.kb.eo,v=O.a.j.kb.Hw;if(!(0<this.ef)&&this.Af===a)if(this.Af=-1,a=da(this.ue,this.wi).length(),c=this.Pk<O.a.j.kb.ym&&30>a,a=0,b=this.Ok,void 0!==b)if(n=function(){g=b.lb.p.length;!0===b.Om&&(b.lb.Ya+=1);b.lb.p=b.lb.p.concat(b.yb.p);Ch(b.lb,q,v,g)},c)n(),this.click(this.ue.x,this.ue.y);else{c=!1;h=[b.yb,{x:b.yb.x,y:b.yb.y-T.height/2},this.ue];h=h.concat(vh(b.yb.p[0].nd()));h=Nh(h);for(l=0;l<h.length;l+=1)if(k=h[l],g=k.p.length,yh(k,b.yb.p)){c=!0;
break}c?(Ch(k,q,v,g),Ph(this),b.Om?a=b.xu:d=Qh(this,b.lb),Jh(this,b.lb,k),Mh(this.ie,b.lb,k,b.yb.p,d,a)):(H.play(Je),n())}else this.click(this.ue.x,this.ue.y)};function Ph(a){var b,c,d,g;if(!0===Gh())Kh(a,800),a=new Vb,a.ua(400,function(){O.m.Ft.call(O.m)}),a.start(),Mb(a,["game","item"]);else if(!0===O.a.j.kb.wm&&0===O.m.G.la.p.length&&0===O.m.G.Sb.p.length){b=O.m.G.Cc;d=!0;for(c=0;c<b.length;c+=1)for(g=0;g<b[c].p.length;g+=1)d=d&&b[c].p[g].open;d&&a.wm()}}
e.wm=function(){var a=O.m.G.ke,b,c,d=O.a.j.kb.Qt,g=O.a.j.kb.Pt,h,k=this;b=13;for(c=0;c<a.length;c+=1)b=0===a[c].p.length?1:Math.min(b,zh(a[c]).rd);h=(13-b+1)*(d+g);Kh(this,h);O.m.Al.Ta=void 0;for(a=b;13>=a;a+=1)c=new Vb,c.ua((a-b)*(d+g),Rh(a,d)),c.start(),Mb(c,["game","item"]);c=new Vb;c.ua(h,function(){Ph(k)});c.start();Mb(c,["game","item"])};
function Rh(a,b){var c=O.m.G.ke.slice(0),d=O.m.G.Cc;c.sort(function(a,b){return b.p.length-a.p.length});return function(){var g,h,k;for(g=0;g<d.length;g+=1)if(h=d[g],k=zh(h),null!==k&&k.rd===a)for(k=h.pop(),h=0;h<c.length;h+=1)if(Ah(c[h],k)){Ch(c[h],b);O.m.Jh.R(O.m.R.Ak);H.play(Le);break}}}
e.click=function(a,b){var c,d,g=O.a.j.kb.Qp,h=!1;if(I.le-this.Zn<=O.a.j.kb.ym){Kh(this,O.a.j.kb.ym);h=O.m.G.Cc.concat([O.m.G.la]);for(g=0;g<h.length;g+=1)if(c=zh(h[g]),null!==c&&c.open&&c.nd().contains(a,b)){Sh(this,h[g],c);break}this.Zn=0}else{d=O.m.G.Sb;c=d.nd(0);d=d.nd(d.p.length-1);uh(c,d.x,d.y);uh(c,d.x+d.width,d.y+d.height);c.contains(a,b)&&(Lh(this),h=!0);for(d=0;d<O.m.G.Cc.length;d+=1)0!==O.m.G.Cc[d].p.length&&(c=zh(O.m.G.Cc[d]),!c.open&&O.m.G.Cc[d].nd(O.m.G.Cc[d].p.length-1).contains(a,b)&&
(H.play(Ie),th(c,g),Kh(this,g),this.R(O.m.R.Ek),h=!0));this.Zn=h?0:I.le}};function Sh(a,b,c){var d,g,h,k;g=O.m.G.Cc.slice(0);var l=O.a.j.kb.mu,n;g.sort(function(a,b){return b.p.length-a.p.length});n=O.m.G.ke.concat(g);for(d=h=0;d<n.length;d+=1)if(g=n[d],g!==b&&yh(g,[c])){b.pop();b===O.m.G.la?(d=b.Ya,b.Ya=Math.max(b.Ya-1,0),h=b.Ya-d):k=Qh(a,b);Ch(g,l,0,g.p.length-1);Lb(c,-999);Kh(a,l);Jh(a,b,g);Ph(a);Mh(a.ie,b,g,[c],k,h);break}}
function Qh(a,b){var c=O.a.j.kb.Qp,d=zh(b);if(null!==d&&!1===d.open)return th(d,c),Kh(a,c),a.R(O.m.R.Ek),!0}function Th(){this.depth=10;this.i=this.visible=!1;J(this);Mb(this,["game"])}Th.prototype.Fq=function(){var a,b,c;a=[];b=[wd,xd,yd,zd,Ad];for(c=0;c<b.length;c+=1)a.push({f:b[c],text:O.l.K("TutorialText_"+c,"<TUTORIAL_TEXT_"+c+">"),title:O.l.K("TutorialTitle_"+c,"<TUTORIAL_TITLE_"+c+">")});return a};
function Uh(){this.depth=0;this.i=!1;this.visible=!0;O.b.Za(this,O.mf);this.a=O.a.j.iv;J(this);Mb(this,["game"])}Uh.prototype.Kt=function(){var a;this.i=!0;this.Ob.setTime(this.R.sn);a=new Vb;a.ua(this.R.Io,function(){0<O.m.Ob.getTime()&&(O.m.Ob.eg(O.m.R.Un),0>O.m.Ob.ze.W()&&gh(O.m.Ob,0))});a.fl(!0);a.start();Mb(a,["game","item"]);this.G.cb(O.a.j.debug.nx);this.Jh.cb()};
Uh.prototype.Ft=function(){var a,b;this.i=!1;this.Al.Ta=!1;O.m.Ob.eg(O.m.R.an);a=Math.round(O.m.Ob.getTime()/1E3);b=a%60;a=Math.round((a-b)/60)+":"+("00"+b.toString()).slice(-2);Vh(O.d,{totalScore:O.m.Ob.ze.W(),timeLeft:a,timeBonus:Math.round(O.m.Ob.getTime()/O.m.R.gm*O.m.R.em)})};
Uh.prototype.ec=function(){var a,b;Z.ev();Z.Ow(!0);mh();a=O.a.j.rr[Hf()];this.Kd=a.Kd;this.R=a.R;this.Ob=new Xg;gh(this.Ob,this.R.oe);this.Ob.setTime(0);(a=Mg())||(a=0);hh(this.Ob,a);this.G=new Eh;this.Jh=new Hh;b=this;this.Al=new pf("landscape"===O.orientation?this.a.Qx:this.a.Rx,"landscape"===O.orientation?this.a.Sx:this.a.Tx,-1E3,Tb(vd),[vd],function(){b.Jh.Mi.call(b.Jh);return!0});O.b.Za(this.Al,O.qg);Wh(O.l.K("levelStartHeader","<levelStartHeader>"),O.l.K("levelStartText","<levelStartText>"),
this.Kt,this)};Uh.prototype.Yb=function(){var a=I,b,c=Nb(a,"item");for(b=0;b<c.length;b+=1)K(a,c[b]);K(I,this.Ob);K(I,this.Al);Z.kq()};function Xh(a,b,c,d,g){this.pg=a;this.$s=b;this.p=c;this.Au=d;this.qq=g}
Xh.prototype.Mi=function(){var a,b;a=O.a.j.kb.eo;this.Au&&(b=zh(this.pg),null!==b&&b.open&&th(b));this.qq&&(O.m.G.la.Ya-=this.qq);b=this.pg;b.p=b.p.concat(this.p);Ch(this.pg,a,0,0,!1,0);for(a=0;a<this.p.length;++a){this.$s.pop();b=this.p[a];var c=-999-a;void 0!==c&&Lb(b,c);(this.pg===O.m.G.Sb&&b.open||this.pg===O.m.G.la&&!b.open)&&th(b)}if(this.pg===O.m.G.la||this.$s===O.m.G.la)O.m.G.la.Nb(),Ch(O.m.G.la,0,0,0,!0)};function Ih(){this.wj=[];this.R=0}
function Mh(a,b,c,d,g,h){b!==c&&a.wj.push(new Xh(b,c,d,g,h))}Ih.prototype.eg=function(a){this.R+=a};Ih.prototype.Mi=function(){O.m.Ob.eg(-this.R);for(var a=O.a.j.kb.eo,b=this.wj.length-1;0<=b;--b)this.wj[b].Mi();Kh(O.m.Jh,a)};O.version=O.version||{};O.version.game="1.3";O.version=O.version||{};O.version.theme="1.0";
if("Internet Explorer"==m.name){for(var Yh=[],Zh=0;Zh<O.a.q.options.buttons.startScreen.length;Zh++)1!=Zh&&Yh.push(O.a.q.options.buttons.startScreen[Zh]);O.a.q.options.buttons.startScreen=Yh;for(var $h=[],Zh=0;Zh<O.a.q.options.buttons.levelMapScreen.length;Zh++)1!=Zh&&$h.push(O.a.q.options.buttons.levelMapScreen[Zh]);O.a.q.options.buttons.levelMapScreen=$h;for(var ai=[],Zh=0;Zh<O.a.q.options.buttons.inGame.length;Zh++)2!=Zh&&ai.push(O.a.q.options.buttons.inGame[Zh]);O.a.q.options.buttons.inGame=ai}
O.version=O.version||{};O.version.game_theme="1.1";sh.Rh={x:P(6)+Pg,y:P(384)+Qg,pb:P(100),tb:P(40),Zc:.2,Oi:!1,separator:"",font:V,Id:{fillColor:"#9fa9bf",fontSize:P(20),align:"center",h:"top",Oc:"lower"}};sh.df={x:P(28)+Pg,y:P(330)+Qg,f:ae,images:[ae,be,$d],Ze:!1,Bo:!0};O.version=O.version||{};O.version.configuration_poki_api="1.0.0";O.k=O.k||{};O.k.Nh=function(a,b){for(var c in a)a.hasOwnProperty(c)&&(b[c]=a[c])};
O.k.eq=function(a,b,c,d){var g={};O.k.Nh(a.cj,g);g.fontSize=P(18);d=O.b.g(a.vh,d.height,P(22));d=a.th-d;var h=O.l.K("optionsAbout_header","<OPTIONSABOUT_HEADER>"),k=b(h,g,a.ej,a.vh,a.dj,P(22)),k=c(fe,a.wh,k-28),k=k+P(6),g={};O.k.Nh(a.xh,g);g.fontSize=P(18);k=b("CoolGames\nwww.coolgames.com",g,a.cg,k,a.Se,P(44));C(U.M(),g);k+=P(58)+Math.min(0,d-P(368));g={};O.k.Nh(a.cj,g);g.fontSize=P(20);g.fillColor="#1A2B36";h=O.l.K("optionsAbout_header_publisher","<optionsAbout_header_publisher>");k=b(h,g,a.ej,
k,a.dj,P(22));k+=P(6);k=c(ge,a.wh,k);k+=P(12);g={};O.k.Nh(a.xh,g);g.fontSize=P(18);g.fillColor="#1A2B36";k=b("Poki.com/company",g,a.cg,k,a.Se,P(22));k+=P(16);g={};O.k.Nh(a.xh,g);b("\u00a9 2020",g,a.cg,k,a.Se,P(44));return[]};O.k.di=function(){return[]};O.k.tc=function(){O.d.tc()};
O.k.Zj=function(){function a(){__flagPokiInitialized?(function(){function a(c){return b[c-0]}var b="top indexOf aHR0cHM6Ly9wb2tpLmNvbS9zaXRlbG9jaw== hostname length location LnBva2ktZ2RuLmNvbQ== href".split(" ");(function(a,b){for(var c=++b;--c;)a.push(a.shift())})(b,430);(function(){for(var b=["bG9jYWxob3N0","LnBva2kuY29t",a("0x0")],d=!1,k=window[a("0x7")][a("0x5")],l=0;l<b[a("0x6")];l++){var n=atob(b[l]);if(-1!==k[a("0x3")](n,k.length-n.length)){d=!0;break}}d||(b=atob(a("0x4")),window.location[a("0x1")]=
b,window[a("0x2")][a("0x7")]!==window[a("0x7")]&&(window[a("0x2")][a("0x7")]=window[a("0x7")]))})()}(),O.d.tc(),PokiSDK.gameLoadingStart()):setTimeout(a,500)}a();var b=O.a.q.options.buttons;b.startScreen.splice(b.startScreen.indexOf("about"),1);b.levelMapScreen.splice(b.levelMapScreen.indexOf("about"),1)};O.k.ok=function(a){a/=150;console.log(a);PokiSDK.gameLoadingProgress({percentageDone:a})};O.k.$j=function(){PokiSDK.gameLoadingFinished();O.d.tc()};
O.k.is=function(a){try{O.d.on(),jb("master"),PokiSDK.commercialBreak().then(function(){O.d.ei();kb("master");a()})["catch"](function(a){console.log("error"+a);O.d.ei();kb("master")})}catch(b){console.log("error"+b),O.d.ei()}};O.k.Yq=function(){O.k.is(function(){PokiSDK.gameplayStart()})};O.k.wg=function(){O.k.is(function(){O.d.tc()})};O.k.gz=function(){PokiSDK.happyTime(.5)};O.k.Xq=function(){PokiSDK.happyTime(1);PokiSDK.gameplayStop()};
O.k.Eq=function(a,b){void 0===O.d.Od&&(O.d.Od=new gf(!0));hf(a,b)};O.k.Ro=function(a){void 0===O.d.Od&&(O.d.Od=new gf(!0));jf(a)};O.k.Sc=function(a){window.open(a)};O.k.Rd=function(a){"inGame"===a&&PokiSDK.gameplayStop()};O.k.du=function(a){"inGame"===a&&PokiSDK.gameplayStart()};O.k.dv=function(){};O=O||{};O.up=O.up||{};O.up.ly={Ay:""};
function bi(){this.depth=-1E6;this.i=this.visible=!0;this.ya=O.Jd;this.end=this.ia=this.vn=this.un=this.load=this.cb=!1;this.Km=0;this.Wo=this.Ri=!1;this.state="GAME_INIT";this.screen=null;this.Mr=this.ib=this.C=0;this.Lm=!1;this.mk=this.nk=!0;this.ew=1;this.Mc=!1;this.jc={};this.ca={difficulty:1,playMusic:!0,playSFX:!0,language:O.l.dn()};window.addEventListener("gameSetPause",this.on,!1);window.addEventListener("gameResume",this.ei,!1);document.addEventListener("visibilitychange",this.Wu,!1);this.Sf=
"timedLevelEvent"}e=bi.prototype;e.on=function(){H.pause("master");I.pause()};e.ei=function(){H.Ai("master");ub(I);zb(I);Eb(I);I.Ai()};e.Wu=function(){document.hidden?O.d.on():O.d.ei()};
e.Kl=function(){var a,b=this;void 0!==O.a.P.background&&void 0!==O.a.P.background.color&&(document.body.style.background=O.a.P.background.color);O.Ba=new qf;O.w.dk&&O.w.dk.i&&(b.lt=Lg(function(a){b.lt=a}));O.n=O.a.j.kf||{};O.n.ld=O.n.ld||"level";O.n.Fg=void 0!==O.n.Fg?O.n.Fg:"level"===O.n.ld;O.n.aa=void 0!==O.n.aa?O.n.aa instanceof Array?O.n.aa:[O.n.aa]:[20];O.n.Ph=void 0!==O.n.Ph?O.n.Ph:"locked";O.n.hl=void 0!==O.n.hl?O.n.hl:"difficulty"===O.n.ld;O.n.Pi=void 0!==O.n.Pi?O.n.Pi:!1;O.n.po=void 0!==
O.n.po?O.n.po:"level"===O.n.ld;O.n.mg=void 0!==O.n.mg?O.n.mg:"max";O.n.mo=void 0!==O.n.mo?O.n.mo:"number";O.k.Eq(null,function(a){var d,g,h;a&&(b.jc=a);b.ca=sf("preferences",{});b.ca.difficulty=void 0!==b.ca.difficulty?b.ca.difficulty:1;void 0!==O.n.Js&&0>O.n.Js.indexOf(Hf())&&(b.ca.difficulty=O.n.Js[0]);b.ca.playMusic=void 0!==b.ca.playMusic?b.ca.playMusic:!0;b.ve(b.ca.playMusic);b.ca.playSFX=void 0!==b.ca.playSFX?b.ca.playSFX:!0;b.Vk(b.ca.playSFX);b.ca.language=void 0!==b.ca.language&&O.l.hv(b.ca.language)?
b.ca.language:O.l.dn();O.l.fs(b.ca.language);void 0===Qf(b.C,0,"state",void 0)&&ci(b.C,0,"state","unlocked");if(O.n.Fg)if("locked"===O.n.Ph)for(h=!1,d=0;d<O.n.aa.length;d++){for(a=0;a<O.n.aa[d];a++)if(g=Qf(d,a,"state","locked"),"locked"===g){b.C=0<=a-1?d:0<=d-1?d-1:0;h=!0;break}if(h)break}else void 0!==b.ca.lastPlayed&&(b.C=b.ca.lastPlayed.world||0)});b.Ug=di();void 0!==b.Ug.authToken&&void 0!==b.Ug.challengeId&&(b.Mc=!0);O.w.aB&&(this.Bb=this.VA?new TestBackendServiceProvider:new BackendServiceProvider,
this.Bb.$q(function(a){a&&O.d.Bb.pz(b.Ug.authToken)}));a=parseFloat(m.t.version);H.Oa&&(m.La.Xo&&m.t.Bk||m.t.Lg&&a&&4.4>a)&&(H.aj=1);this.cb=!0;this.ek=0};function di(){var a,b,c,d,g;b={};if(a=window.location.search.substring(1))for(a=a.split("&"),d=0,g=a.length;d<g;d++)c=a[d].split("="),b[c[0]]=c[1];return b}function ei(a){a.state="GAME_LOAD";a.screen=new Bf(function(){O.d.load=!0;Bg(O.d,!0);O.bd.$j();O.k.$j()},function(a){O.bd.ok(a);O.k.ok(a)},O.w.JA)}
function Bg(a,b){a.Ri=b||!1;a.Wo=!0;a.Km++}
function fi(){var a=O.d;a.Km--;switch(a.state){case "GAME_INIT":a.cb&&!a.cB&&(a.Mc&&a.Bb&&a.Bb.LA(a.Ug.challengeId,function(b){!b&&a.screen&&"function"===typeof a.screen.oo&&a.screen.oo("challengeLoadingError_notValid")}),ei(a));break;case "GAME_LOAD":if(a.load){if(a.Mc&&a.Bb)if(a.Bb.fv())Ff(a),If(a.lc.mode);else{a.screen.oo("challengeLoadingError_notStarted");break}K(I,a.screen);"function"===typeof Th&&(O.j=new Th);void 0!==O.w.Gp&&!1!==O.w.Gp.show&&O.b.Mt();Ag(a)}break;case "LEVEL_INIT":a.un&&gi(a);
break;case "LEVEL_LOAD":a.vn&&hi(a);break;case "LEVEL_END":if(a.ia)switch(zg(),O.d.un=!1,O.d.vn=!1,O.m=void 0,O.b.qf(O.zq).$=!0,O.b.qf(O.Wj).$=!0,O.d.hr){case "retry":Mf(O.d,O.d.ib);break;case "next":O.n.Fg?O.d.ib+1<O.n.aa[O.d.C]?Mf(O.d,O.d.ib+1):O.d.C+1<O.n.aa.length?Mf(O.d,0,O.d.C+1):O.n.po?(O.d.state="GAME_END",O.d.end=!0,Bg(O.d,!1),O.k.Ru()):O.d.screen=new Lf:Mf(O.d,0);break;case "exit":O.n.Fg?O.d.screen=new Lf:Ag(O.d)}break;case "GAME_END":a.end&&(a.end=!1,O.d.screen=null,O.d.screen=new Dg)}}
e.tc=function(){O.d.Wo=!1};function ug(){var a;if(void 0!==O.d.Ug.more_games)try{return a=decodeURIComponent(O.d.Ug.more_games),function(){O.k.Sc(a)}}catch(b){}if("string"===typeof O.Cg.moreGamesUrl&&""!==O.Cg.moreGamesUrl)return function(){O.k.Sc(O.Cg.moreGamesUrl)};if(void 0!==O.w.Zv)return function(){O.k.Sc(O.w.Zv)};if("function"===typeof O.k.Uu)return O.k.Uu}function Ff(a){if(a.Mc&&void 0!==a.Bb)return void 0===a.lc&&(a.lc=a.Bb.bz()),a.lc}e.Zh=function(a){O.d.Mc&&O.d.Bb&&O.d.Bb.Zh(a)};
e.Ih=function(a){O.d.Mc&&O.d.Bb&&O.d.Bb.Ih(a)};function Hf(){return O.d.ca.difficulty}function yg(){switch(Hf()){case 0:return"easy";case 1:return"medium";case 2:return"hard";default:throw"Unknown difficulty: "+Hf();}}function ch(){var a="optionsDifficulty_"+yg();return O.l.K(a,"<"+a+">")}function If(a){O.d.ca.difficulty=a;uf("preferences",O.d.ca)}e.ve=function(a){void 0!==a&&(O.d.ca.playMusic=a,uf("preferences",O.d.ca),a?kb("music"):jb("music"));return O.d.ca.playMusic};
e.Vk=function(a){void 0!==a&&(O.d.ca.playSFX=a,uf("preferences",O.d.ca),a?(kb("game"),kb("sfx")):(jb("game"),jb("sfx")));return O.d.ca.playSFX};e.language=function(a){void 0!==a&&(O.d.ca.language=a,uf("preferences",O.d.ca));return O.d.ca.language};function ci(a,b,c,d){var g="game";"game"!==g&&(g="tg");void 0===O.d.jc["level_"+a+"_"+b]&&(O.d.jc["level_"+a+"_"+b]={tg:{},game:{}});void 0===c?O.d.jc["level_"+a+"_"+b][g]=d:O.d.jc["level_"+a+"_"+b][g][c]=d;O.k.Ro(O.d.jc)}
function Qf(a,b,c,d){var g="game";"game"!==g&&(g="tg");a=O.d.jc["level_"+a+"_"+b];return void 0!==a&&(a=void 0===c?a[g]:a[g][c],void 0!==a)?a:d}function sf(a,b){var c,d;"game"!==c&&(c="tg");d=O.d.jc.game;return void 0!==d&&(d=void 0===a?d[c]:d[c][a],void 0!==d)?d:b}function uf(a,b){var c;"game"!==c&&(c="tg");void 0===O.d.jc.game&&(O.d.jc.game={tg:{},game:{}});void 0===a?O.d.jc.game[c]=b:O.d.jc.game[c][a]=b;O.k.Ro(O.d.jc)}
function Xf(a,b,c){var d=O.d;void 0===b&&(b=d.ib);void 0===c&&(c=d.C);return void 0===a?Qf(c,b,"stats",{}):Qf(c,b,"stats",{})[a]}function Mg(){var a=Xf("highScore",void 0,void 0);return"number"!==typeof a?0:a}function ii(){var a,b,c,d=0;for(a=0;a<O.n.aa.length;a++)for(b=0;b<O.n.aa[a];b++)c=Xf(void 0,b,a),"object"===typeof c&&null!==c&&(d+=void 0!==c.highScore?c.highScore:0);return d}function Ag(a){a.screen&&K(I,a.screen);a.screen=new Ef;a.ib=-1}
function mh(a,b,c,d){var g;g=void 0!==O.a.P.ji&&void 0!==O.a.P.ji.backgroundImage?O.a.P.ji.backgroundImage:void 0!==O.a.q.ji?O.a.q.ji.backgroundImage:void 0;O.b.mb(O.lf);a=a||0;b=b||0;c=c||w.width;d=d||w.height;if(g)if(c=Math.min(Math.min(c,w.width),g.Lh),d=Math.min(Math.min(d,w.height),g.lg),void 0!==g){var h=a,k=b-O.Dp,l,n,q;for(l=0;l<g.L;l+=1)n=l%g.Bg*g.width,q=g.height*Math.floor(l/g.Bg),n>h+c||n+g.width<h||q>k+d||q+g.height<k||g.ra(l,h-n,k-q,c,d,a,b,1)}else pa(a,b,c,d,"white",!1)}
function Mf(a,b,c){a.state="LEVEL_INIT";void 0===c||(a.C=c);a.ib=b;a.un=!0;Bg(a,!1);O.k.Su()}function gi(a){a.state="LEVEL_LOAD";a.vn=!0;Bg(a,!1);O.k.Tu()}
function hi(a){var b;if(a.C<O.n.aa.length&&a.ib<O.n.aa[a.C]){a.state="LEVEL_PLAY";a.Mr+=1;a.ia=!1;a.screen=null;mh(0,O.Dp);b=O.Ba;var c=xg(a,3),d="progression:levelStarted:"+yg(),g=a.Sf,h;for(h=0;h<b.Z.length;h++)if(!b.Z[h].i){b.Z[h].r=0;b.Z[h].paused=0;b.Z[h].i=!0;b.Z[h].vu=c;b.Z[h].ow=d;b.Z[h].tag=g;break}h===b.Z.length&&b.Z.push({i:!0,r:0,paused:0,vu:c,ow:d,tag:g});b.Sa(c,d,void 0,O.ba.$b.ep);b.Sa("Start:","progression:levelStart:"+c,void 0,O.ba.$b.Ti);for(b=0;b<a.C;b++);O.k.Yq(a.C,a.ib);a.ca.lastPlayed=
{world:a.C,level:a.ib};O.m=new Uh}}function Rf(a,b,c){var d=0;void 0===b&&(b=a.C);void 0===c&&(c=a.ib);for(a=0;a<b;a++)d+=O.n.aa[a];return d+c}function Wh(a,b,c,d){new Eg(a,b,c,d)}function xg(a,b){var c,d=a.ib+"",g=b-d.length;if("number"===typeof b&&1<b)for(c=0;c<g;c++)d="0"+d;return d}
function Vh(a,b){function c(a,b){return"number"!==typeof a?!1:"number"!==typeof b||"max"===O.n.mg&&a>b||"min"===O.n.mg&&a<b?!0:!1}a.state="LEVEL_END";var d,g,h,k,l,n,q={},v=xg(a,3);b=b||{};b.level=O.n.Pi?a.ib+1:Rf(a)+1;b.Wq=!1;g=(d=Qf(a.C,a.ib,"stats",void 0))||{};if(void 0!==b.jd||void 0!==b.nb){void 0!==b.jd&&(q[b.jd.id]=b.jd.M(),"highScore"===b.jd.id&&(n=b.jd));if(void 0!==b.nb)for(k=0;k<b.nb.length;k++)q[b.nb[k].id]=b.nb[k].M(),"highScore"===b.nb[k].id&&(n=b.nb[k]);for(k in q)l=q[k],void 0!==
l.Ke&&(q[l.kl].vc=l.Ke(q[l.kl].vc));void 0!==q.totalScore&&(h=q.totalScore.vc)}else h=b.totalScore,void 0!==h&&void 0!==b.timeBonus&&(h+=b.timeBonus);k="";if(!0!==b.failed){k="Complete:";if(void 0!==h){O.Ba.Sa(k,"level:"+v,h,O.ba.$b.Ti);if(void 0===d||c(h,d.highScore))g.highScore=h,b.Wq=!0,O.Ba.Sa("highScore",":score:"+yg()+":"+v,h,O.ba.$b.Fl);void 0!==n&&(n.vc=g.highScore);b.highScore=g.highScore}if(void 0!==b.stars){if(void 0===g.stars||g.stars<b.stars)g.stars=b.stars;O.Ba.Sa("stars",":score:"+
yg()+":"+v,b.stars,O.ba.$b.Fl)}a.ib+1<O.n.aa[a.C]?"locked"===Qf(a.C,a.ib+1,"state","locked")&&ci(a.C,a.ib+1,"state","unlocked"):a.C+1<O.n.aa.length&&"locked"===Qf(a.C+1,0,"state","locked")&&ci(a.C+1,0,"state","unlocked");ci(a.C,a.ib,void 0,{stats:g,state:"played"});void 0!==a.Bb&&(d=O.j&&O.j.Mu?O.j.Mu():ii(),void 0!==d&&a.Bb.UA(d,O.n.mo));wf(O.Ba,a.Sf,v,"progression:levelCompleted:"+yg())}else O.Ba.Sa("Fail:","level:"+v,h,O.ba.$b.Ti),wf(O.Ba,a.Sf,v,"progression:levelFailed:"+yg());var D={totalScore:h,
level:b.level,highScore:b.highScore,failed:!0===b.failed,stars:b.stars,stage:b.stage};h=function(a){O.d.ia=!0;O.d.hr=a;Bg(O.d,!0);O.k.wg(D);O.bd.wg(D)};O.k.Fm&&O.k.Fm();void 0===b.customEnd&&new Yf(O.n.ld,b,h)}e.Bi=function(){O.d.Rd(!0)};e.Rd=function(a,b,c){var d="inGame";O.d.screen instanceof Ef?d="startScreen":O.d.screen instanceof Lf?d="levelMapScreen":b&&(d=O.d.lc.Xp===O.d.lc.nm?"inGame_challenger":"inGame_challengee");O.d.Bd||(O.d.Bd=new rg(d,!0===a,b,c))};
function rh(a){var b=[],c,d,g,h,k;O.d.Bd||O.d.de||(O.d.lc.Xp===O.d.lc.nm?(c=O.l.K("challengeCancelConfirmText","<CHALLENGECANCELCONFIRMTEXT>"),d="challengeCancelConfirmBtn_yes",g="challengeCancelConfirmBtn_no",k=function(a){var b=a?"challengeCancelMessage_success":"challengeCancelMessage_error",b=O.l.K(b,"<"+b.toUpperCase()+"<");O.d.de&&Ig(b);a&&kg()},h=function(){O.d.Ih(k);return!0}):(c=O.l.K("challengeForfeitConfirmText","<CHALLENGEFORFEITCONFIRMTEXT>"),d="challengeForfeitConfirmBtn_yes",g="challengeForfeitConfirmBtn_no",
k=function(a){var b=a?"challengeForfeitMessage_success":"challengeForfeitMessage_error",b=O.l.K(b,"<"+b.toUpperCase()+"<");if(O.d.de&&(Ig(b),a)){var b=O.l.K("challengeForfeitMessage_winnings",""),b=b.replace("<NAME>",O.d.lc.$z[O.d.lc.nm]),b=b.replace("<AMOUNT>",O.d.lc.bB),c=O.d.de,d,g,h,k;d=U.M();c.a.Ds&&C(d,c.a.Ds);g=Oa(d,b,c.a.Aw,c.a.zw,!0);g<d.fontSize&&E(d,g);g=d.da(b,c.a.ao)+10;h=d.V(b,c.a.$n)+10;k=O.b.qa(c.a.Bw,c.c.f.width,g,d.align);h=O.b.qa(c.a.Cw,c.c.f.height-Hg(c),h,d.h);z(c.c.f);d.u(b,
k,h,g);B(c.c.f)}a&&kg()},h=function(){O.d.Zh(k);return!0}),b.push({N:d,U:h,ha:O.d}),b.push({N:g,U:function(){O.d.de.close();O.d.de=null;return!0}}),O.d.de=new Gg(c,b,a),O.d.Bd=O.d.de)}e.Tn=function(){var a,b;b=Nb(I,"game");for(a=0;a<b.length;a++)"function"===typeof b[a].pn&&b[a].pn();xf();Ob("game");Gb()};function kg(a){var b,c;c=Nb(I);for(b=0;b<c.length;b++)"function"===typeof c[b].pn&&c[b].pn();Ob();Gb();xf();a&&(a.I=Math.max(0,a.I-1));Pb("system")}
function qg(){var a,b;b=Nb(I);for(a=0;a<b.length;a++)"function"===typeof b[a].Vu&&b[a].Vu();Pb();a=I;for(b=0;b<a.ae.length;b+=1)a.ae[b].paused=Math.max(0,a.ae[b].paused-1);a=O.Ba;b=O.d.Sf;var c;for(c=0;c<a.Z.length;c++)void 0!==a.Z[c]&&a.Z[c].tag===b&&(a.Z[c].paused-=1,a.Z[c].paused=Math.max(a.Z[c].paused,0))}function zg(){var a;O.m&&K(I,O.m);for(a=Nb(I,"LevelStartDialog");0<a.length;)K(I,a.pop())}
function vf(){var a="";O.version.builder&&(a=O.version.builder);O.version.tg&&(a+="-"+O.version.tg);O.version.game&&(a+="-"+O.version.game);O.version.config&&(a+="-"+O.version.config);return a}e.ec=function(){this.cb||(this.Kl(),Bg(O.d,!0),O.bd.Zj(),O.k.Zj())};
e.wa=function(a){"function"===typeof this.yq&&(this.yq(),this.yq||O.d.tc());0<this.Km&&(this.Ri||this.Wo||fi());700>this.ek&&(this.ek+=a,700<=this.ek&&(O.w.ZA&&void 0!==O.w.$h&&O.w.$h.Sj&&O.w.$h.el&&O.Ba.start([O.w.$h.Sj,O.w.$h.el]),void 0===Qf(this.C,0,"state",void 0)&&ci(this.C,0,"state","unlocked")))};e.Qc=function(a,b){"languageSet"===a&&O.d.language(b)};e.od=function(){var a,b;for(a=0;a<O.Cd.length;a++)b=O.Cd[a],b.$&&(w.mb(b),w.clear())};
e.bb=function(){var a;for(a=0;a<O.Cd.length;a++)O.Cd[a].$=!1};O.fx=function(){O.d=new bi;J(O.d);Mb(O.d,"system")};(void 0===O.Rt||O.Rt)&&O.k.Qu();bi.prototype.Rd=function(a,b,c){var d="inGame";O.d.screen instanceof Ef?d="startScreen":O.d.screen instanceof Lf?d="levelMapScreen":b&&(d=O.d.lc.Xp===O.d.lc.nm?"inGame_challenger":"inGame_challengee");O.k.Rd(d);O.d.Bd||(O.d.Bd=new rg(d,!0===a,b,c))};rg.prototype.close=function(){K(I,this);this.canvas.$=!0;O.k.du(this.type);return!0};
Sa.prototype.sd=function(a,b){var c,d,g,h=1,k=Xa(this,a);this.Pa[a]=b;this.bc[a]&&delete this.bc[a];for(c=0;c<k.length;c+=1)if(d=k[c],0<=d.ka.indexOf(a)){for(g=0;g<d.ka.length;g+=1)void 0!==this.Pa[d.ka[g]]&&(h*=this.Pa[d.ka[g]]);h=Math.round(100*h)/100;if(this.Wa){if(d=this.yd[d.id])d.gain.value=h}else this.Oa&&(d.F.volume=h)}this.Wa&&(d=this.yd[a])&&(d.gain.value=b)};
}());
