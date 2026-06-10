# تقرير تدقيق مزامنة الرسم مع الفيزياء

## 1. الحكم العام على الرسم

الحكم: **الرسم مربوط جزئياً**.

الربط الأساسي صحيح: مواضع الكرات، حالة النشاط، التصويب، الضرب، القفز، الإحصائيات، وأبعاد الطاولة كلها تأتي من `physics.js` أو من قيم واجهة تصل إلى `shootCueBall`. لكن توجد مشاكل مرئية تمنع القول إن كل عنصر مرئي مطابق تماماً للنموذج الفيزيائي: جيوب الطاولة مرسومة بأسطوانة مدارة عمودياً بدل قرص أفقي واضح، دوران الكرات غير مقروء على الكرات الصلبة بسبب عدم وجود علامات سطحية، وظهور العصا ودليل التصويب يعتمد على حالة `canShoot` منشورة كل `0.12s` لا على الحالة اللحظية مباشرة.

## 2. فصل الرسم عن الفيزياء

الفصل العام جيد.

- `physics.js` يملك الحركة والتصادمات والدوران والجيوب والقفز عبر `stepWorld`, `shootCueBall`, `resolveBallCollisions`, `handleTableWalls`, `tryPocketBall`, `respotCueBallIfNeeded`.
- `App.jsx` ينشئ العالم عبر `makeWorld`, يستدعي `stepWorld(worldRef.current, FIXED_DT)`, ثم يزامن meshes في `syncMeshes`.
- `Table`, `BallMesh`, `AimGuide`, `CueStick` هي عناصر رسم فقط.
- `App.jsx` لا يحسب حركة بديلة للكرات. الاستثناء الصغير: `registerMesh` يكتب `ball.mesh = mesh || null` داخل كائن الكرة، و`physics.js` يحتوي الحقل `mesh` في `makeBall`. هذا لا يؤثر على الفيزياء، لكنه يخلط مرجعاً مرئياً داخل حالة الفيزياء.

مراجع الكود: `src/App.jsx:162`, `src/App.jsx:193`, `src/App.jsx:248`, `src/App.jsx:273`, `src/physics.js:266`, `src/physics.js:508`, `src/physics.js:538`, `src/physics.js:751`.

## 3. مزامنة موقع الكرات

المزامنة صحيحة في المسار الأساسي.

- `BallMesh` يبدأ من `ball.position.x/y/z`.
- `syncMeshes` يحدّث `mesh.position` مباشرة من `ball.position.x/y/z`.
- الكرات الطائرة ترتفع بصرياً لأن `stepWorld` يغير `position.y`, و`syncMeshes` ينسخها كما هي.
- الهبوط يرجع الكرة إلى `BALL_Y` عبر `landBallOnTable`.
- الكرات غير النشطة أو التي دخلت الجيب تصبح مخفية عبر `mesh.visible = ball.active`.
- كرة cue بعد scratch تظهر في موضع respot الفيزيائي لأن `respotCueBallIfNeeded` ينسخ `safeSpot` إلى `cue.position`, وبعدها `syncMeshes` ينسخ الموضع إلى mesh.

لم أجد موضع كرة محسوباً بصرياً بشكل مستقل عن الفيزياء.

مراجع الكود: `src/App.jsx:137`, `src/App.jsx:198`, `src/App.jsx:201`, `src/physics.js:242`, `src/physics.js:713`, `src/physics.js:738`, `src/physics.js:759`, `src/physics.js:782`.

## 4. مزامنة دوران الكرات

الدوران متصل بمتغير `omega`, لكنه غير مثالي بصرياً.

- `syncMeshes` يستخدم `ball.omega.x/y/z` لتحديث `mesh.rotation.x/y/z`.
- لا يوجد دوران مزيف مبني على السرعة فقط، لكن يوجد شرط `speedXZ > 0` قبل تطبيق الدوران.
- `shootCueBall` يربط `cueContactY` مع `omega.x/z` للتوبسبن والباكسبن، ويربط `cueContactX` مع `omega.y` للسایدسبن.
- `omega.y` يظهر كدوران حول محور Y في mesh، لكنه مرئي فعلياً فقط عندما توجد علامة سطحية واضحة مثل stripe. الكرة البيضاء والكرات الصلبة لونها موحد، لذلك دورانها غير قابل للتمييز بصرياً.

مشكلة مهمة: شرط `speedXZ > 0` يعني أن دوراناً موجوداً مع سرعة أفقية صفرية لن يتحرك بصرياً. هذا غالباً لا يظهر في الاستخدام العادي، لكنه يجعل الربط غير كامل من ناحية strict sync.

مراجع الكود: `src/App.jsx:207`, `src/App.jsx:209`, `src/App.jsx:210`, `src/App.jsx:211`, `src/physics.js:306`, `src/physics.js:307`, `src/physics.js:308`, `src/physics.js:392`.

## 5. الطاولة والحواف

الأبعاد الأساسية متطابقة.

- `TABLE_WIDTH`, `TABLE_DEPTH`, `TABLE_HEIGHT`, `BALL_RADIUS`, `BALL_Y` معرفة في `physics.js`.
- سطح الطاولة في `App.jsx` يستخدم `TABLE_WIDTH`, `TABLE_HEIGHT`, `TABLE_DEPTH` مباشرة.
- حدود الاصطدام الفيزيائي هي مركز الكرة عند `TABLE_WIDTH / 2 - BALL_RADIUS` و`TABLE_DEPTH / 2 - BALL_RADIUS`.
- الحواف المرئية موضوعة خارج حدود سطح الطاولة، والوجه الداخلي للrail يطابق حد الطاولة تقريباً، لذلك الكرة بصرياً تلامس الحافة عند نفس المكان الذي ينعكس فيه مركزها في الفيزياء.

لا توجد فجوة واضحة حيث تصطدم الكرة فيزيائياً قبل أو بعد الحافة المرئية.

مراجع الكود: `src/physics.js:4`, `src/physics.js:5`, `src/physics.js:6`, `src/physics.js:8`, `src/physics.js:9`, `src/App.jsx:47`, `src/App.jsx:51`, `src/App.jsx:56`, `src/App.jsx:61`, `src/App.jsx:66`, `src/physics.js:508`.

## 6. الجيوب

الربط العددي صحيح، لكن التمثيل المرئي للجيب فيه مشكلة.

- مواضع الجيوب المرئية تستخدم `POCKETS.map`, أي نفس نقاط الفيزياء في x/z.
- نصف قطر الجيب المرئي يستخدم `POCKET_RADIUS`.
- اكتشاف دخول الجيب في الفيزياء يستخدم نفس `POCKET_RADIUS`.
- الكرات تختفي عند دخول الجيب لأن `pocketBall` يجعل `active = false`, ثم `syncMeshes` يخفي mesh.

المشكلة: pocket mesh عبارة عن `cylinderGeometry` مع `rotation={[Math.PI / 2, 0, 0]}`. في Three.js الأسطوانة أصلها بمحور Y، وهذا الدوران يجعل القرص أقرب إلى وضع عمودي لا قرص أفقي على سطح الطاولة. كذلك مركز الجيب عند `TABLE_HEIGHT / 2 + 0.006`، ومع الدوران يصبح نصف القطر ممتداً عمودياً بصرياً. لذلك الجيوب مرتبطة في x/z/radius، لكنها قد لا تبدو كفتحات صحيحة على سطح الطاولة.

مراجع الكود: `src/App.jsx:71`, `src/App.jsx:74`, `src/App.jsx:75`, `src/App.jsx:77`, `src/physics.js:49`, `src/physics.js:435`, `src/physics.js:443`.

## 7. العصا ودليل التصويب

الربط صحيح في الاتجاه والموضع الفيزيائي.

- `CueStick` و`AimGuide` يأخذان `cuePos` من كرة cue في الفيزياء عبر `publishStats`.
- اتجاه `angleDeg` يطابق `shootCueBall`: الفيزياء تستخدم `cos(angle)` لمحور x و`sin(angle)` لمحور z، والرسم يدور المجموعة بـ`-angle` بحيث يتجه المحور المحلي +x إلى نفس الاتجاه.
- `aimFromPoint` يحسب الزاوية من موضع cue الفيزيائي باستخدام `atan2(dz, dx)`.
- طول دليل التصويب وpullback العصا يعتمدان على `power` بصرياً فقط. التأثير الفيزيائي الحقيقي يحدث عند `shootCueBall`.
- العصا ودليل التصويب مخفيان عندما `viewState.canShoot` false.

ملاحظة: y الخاص بالعصا والدليل ثابت ومشتق من `BALL_Y`, وليس من `cue.position.y`. هذا مقبول لأنهما لا يظهران إلا في حالة canShoot عندما تكون الكرة على الطاولة، لكنه ليس مزامنة y كاملة لو تغير شرط الظهور مستقبلاً.

مراجع الكود: `src/App.jsx:85`, `src/App.jsx:94`, `src/App.jsx:108`, `src/App.jsx:117`, `src/App.jsx:216`, `src/App.jsx:233`, `src/App.jsx:244`, `src/physics.js:290`, `src/physics.js:294`, `src/physics.js:295`.

## 8. عناصر التحكم والفيزياء

كل عناصر التحكم الأساسية تصل إلى الفيزياء.

- `power` يصل إلى `shootCueBall(world, power, ...)`.
- `angleDeg` يصل إلى `shootCueBall` ويستخدم كـtheta.
- `cueContactY` يصل إلى `shootCueBall` ويتحول إلى `omega.x/z`.
- `cueContactX` يصل إلى `shootCueBall` ويتحول إلى `omega.y`.
- `cueElevationDeg` يصل إلى `shootCueBall` ويتحول إلى `vy` عبر `sin(alpha)`.
- زر reset يغير `resetSignal`, ثم `resetSimulation` ينشئ `makeWorld`.
- زر shoot يغير `hitSignal`, ثم `useFrame` يستدعي `shootCueBall`.

لم أجد control مرئياً غير متصل بالفيزياء. توجد ملاحظة UI فقط: القيم النصية مثل `Topspin`, `Backspin`, `Sidespin Right`, و`Scratch` إنجليزية داخل واجهة عربية.

مراجع الكود: `src/App.jsx:327`, `src/App.jsx:349`, `src/App.jsx:258`, `src/App.jsx:373`, `src/App.jsx:452`, `src/physics.js:280`, `src/physics.js:291`, `src/physics.js:297`, `src/physics.js:306`.

## 9. حالة canShoot

الحالة الفيزيائية صحيحة، لكن الواجهة قد تتأخر قليلاً.

- `canShoot` يأتي من `getStats`.
- `getStats` يحسب `moving` عبر `isBallMoving`.
- `isBallMoving` يحسب السرعة الأفقية، السرعة العمودية، `isAirborne`, وارتفاع y فوق `BALL_Y`.
- `shootCueBall` نفسه يمنع الضرب عندما توجد كرات متحركة عبر `areAnyBallsMoving`.
- زر الضرب يستخدم `disabled={!stats.canShoot}`.
- العصا ودليل التصويب يستخدمان `viewState.canShoot`.

المخاطرة: `publishStats` يحدث كل `0.12s` فقط، لذلك قد تبقى العصا أو زر الضرب ظاهرين أو مفعّلين لحظة قصيرة بعد بدء الحركة. الفيزياء تمنع الضربة الثانية فعلياً، لكن الواجهة قد لا تعكس الحالة فوراً.

مراجع الكود: `src/physics.js:144`, `src/physics.js:162`, `src/physics.js:174`, `src/App.jsx:216`, `src/App.jsx:222`, `src/App.jsx:285`, `src/App.jsx:455`, `src/App.jsx:302`.

## 10. Shot Jump rendering

القفز متزامن بصرياً مع الفيزياء.

- `cueElevationDeg` يتحول إلى `alpha`, ثم `vy = shotSpeed * Math.sin(alpha)`.
- `stepWorld` يطبّق الجاذبية على `velocity.y` ويضيف `velocity` إلى `position`.
- الكرات الطائرة تتجاوز احتكاك القماش لأن `stepWorld` يعمل `continue` داخل فرع airborne.
- الهبوط يرجع y إلى `BALL_Y` عبر `landBallOnTable`.
- لا يظهر أن الكرة يمكن أن تبقى تحت الطاولة، لأن `landBallOnTable` يعيدها قبل `syncMeshes`, وتصحيح التصادم 3D يستخدم `Math.max(..., BALL_Y)`.
- التصادمات 3D أثناء الطيران تعدّل y والسرعات، والرسم يقرأ `position.y` بعدها.

ملاحظة: أثناء الطيران، الكود يتجاوز rails وpocket checks أيضاً. هذا ليس انفصالاً بين الرسم والفيزياء، لكنه قد يسمح بمشهد كرة فوق حافة/جيب دون تفاعل حتى الهبوط.

مراجع الكود: `src/physics.js:291`, `src/physics.js:293`, `src/physics.js:310`, `src/physics.js:755`, `src/physics.js:758`, `src/physics.js:761`, `src/physics.js:628`, `src/physics.js:605`.

## 11. إظهار الكرات المخططة أو الألوان

الألوان متصلة ببيانات الكرة، لكن تمثيل الخطوط ليس مثالياً.

- كرة cue بيضاء من `makeInitialBalls`.
- الكرات الملونة تستخدم `OBJECT_BALL_COLORS`.
- الكرة السوداء مميزة باللون `#111827`.
- الكرات ذات `id > 8` تحصل على child mesh أبيض كعلامة stripe، وهذا child يتبع دوران parent لأنه داخل mesh الكرة.

المشاكل:

- stripe ليس شريط بلياردو محيطي دقيقاً، بل sphere مضغوط ومرفوع على محور y.
- قد تظهر آثار تداخل أو z-fighting لأن child sphere قريب جداً من سطح الكرة ومكبر قليلاً بـ`scale={[1.006, 0.18, 1.006]}`.
- الكرات الصلبة والكرة البيضاء بلا علامات، لذلك دورانها الفيزيائي غير مقروء بصرياً.

مراجع الكود: `src/physics.js:58`, `src/physics.js:107`, `src/App.jsx:130`, `src/App.jsx:131`, `src/App.jsx:142`.

## 12. الكاميرا والإضاءة والظلال

المشهد قابل للفهم عموماً.

- الكاميرا ثابتة أعلى وأمام الطاولة، و`lookAt(0, 0, 0)` يحدث كل frame.
- الإضاءة فيها ambient وdirectional وpoint، وهذا كاف لتمييز الطاولة والكرات.
- الظلال مفعلة، ولا يوجد ما يشير إلى أنها تخفي الكرات بالكامل.
- دليل التصويب مرفوع فوق سطح الكرة، لذلك لا يبدو معرضاً لz-fighting مع الطاولة.

المخاطر المرئية:

- الجيوب بسبب الدوران قد تتداخل بصرياً مع سطح الطاولة والحواف.
- stripe child قد يتداخل مع جسم الكرة.
- الكاميرا fixed من دون أدوات تدوير، لكنها كافية للتدقيق الأساسي.

مراجع الكود: `src/App.jsx:249`, `src/App.jsx:295`, `src/App.jsx:296`, `src/App.jsx:297`, `src/App.jsx:298`, `src/App.jsx:344`, `src/App.jsx:347`.

## 13. الإحصائيات المعروضة

الإحصائيات متصلة مباشرة بحالة الفيزياء، وهي أقرب إلى debug/status values.

- `cueSpeed` من سرعة cue الأفقية فقط، مع `toFixed(2)`.
- `moving` عدد الكرات التي يراها `isBallMoving`.
- `collisions`, `pocketed`, `scratches` من كائن world.
- `canShoot` من cue active و`moving === 0`.
- لوحة UI تعرض هذه القيم كما هي.

مراجع الكود: `src/physics.js:162`, `src/physics.js:167`, `src/physics.js:170`, `src/physics.js:171`, `src/physics.js:172`, `src/physics.js:173`, `src/physics.js:174`, `src/App.jsx:477`.

## 14. CSS/layout

الترتيب العام جيد ولا يوجد overlap واضح.

- `.layout` يستخدم grid بعمود canvas وعمود panel، لذلك لا يتداخل panel مع canvas على desktop.
- عند `max-width: 980px` يتحول layout إلى عمود واحد، وهذا يمنع التداخل على الشاشات الأصغر.
- `.app-shell` يستخدم `direction: rtl`, لذلك الاتجاه العربي مناسب.
- canvas داخل `.canvas-card` له `overflow: hidden` وارتفاع ثابت/نسبي، وهذا يحمي التخطيط من التمدد.
- labels والsliders قابلة للقراءة، لكن وجود نصوص إنجليزية داخل الواجهة العربية قد يربك قليلاً.

ملاحظة: `.canvas-card` يستخدم `border-radius: 28px`, وهذا تجميلي ولا يسبب مشكلة فيزيائية، لكنه قد يقص المشهد عند الحواف لو اقتربت الكاميرا أو العناصر جداً من الإطار.

مراجع الكود: `src/styles.css:23`, `src/styles.css:32`, `src/styles.css:41`, `src/styles.css:103`, `src/styles.css:115`, `src/styles.css:181`, `src/styles.css:192`.

## 15. مقارنة الرسم بالفيزياء بنداً بنداً

| العنصر المرئي | مصدره الفيزيائي | هل الربط صحيح؟ | مكان الكود | ملاحظات |
|---|---|---|---|---|
| ball position | `ball.position` | نعم | `src/App.jsx:201`, `src/physics.js:90` | x/y/z من الفيزياء مباشرة |
| ball rotation | `ball.omega` | جزئياً | `src/App.jsx:209` | يستخدم omega، لكن بشرط `speedXZ > 0` والدوران غير مرئي على الكرات الصلبة |
| cue position | كرة cue في `world.balls[0]` | نعم | `src/App.jsx:216`, `src/App.jsx:219` | y للعصا ثابت بصرياً، x/z من الفيزياء |
| aim guide | `cue.position` و`angleDeg` | نعم | `src/App.jsx:85`, `src/App.jsx:94`, `src/App.jsx:244` | الاتجاه يطابق `shootCueBall` |
| table dimensions | `TABLE_WIDTH`, `TABLE_DEPTH`, `TABLE_HEIGHT` | نعم | `src/App.jsx:47`, `src/physics.js:4` | السطح مطابق للثوابت |
| rail positions | حدود الطاولة وثخانة rail | نعم | `src/App.jsx:51`, `src/physics.js:508` | الوجه الداخلي يطابق حدود الاصطدام تقريباً |
| pocket positions | `POCKETS` | جزئياً | `src/App.jsx:71`, `src/physics.js:49` | x/z صحيح، orientation المرئي مشكوك فيه |
| pocket visibility/removal | `ball.active` و`tryPocketBall` | نعم | `src/App.jsx:198`, `src/physics.js:443` | الكرة تختفي عند pocket |
| scratch respot | `respotCueBallIfNeeded` | نعم | `src/physics.js:713`, `src/physics.js:738` | الرسم ينسخ الموضع الجديد |
| shot jump height | `position.y` | نعم | `src/physics.js:759`, `src/App.jsx:203` | القفز والهبوط يظهران عبر y |
| canShoot visibility | `getStats().canShoot` | جزئياً | `src/App.jsx:222`, `src/App.jsx:285` | صحيح لكنه يتأخر حتى 0.12 ثانية |
| stats panel | `getStats(world)` | نعم | `src/physics.js:162`, `src/App.jsx:477` | قيم status/debug مباشرة |

## 16. مشاكل أو مخاطر

- جيوب الطاولة مرسومة بأسطوانة مدارة حول X، وهذا قد يجعلها تبدو عمودية لا كفتحة أفقية على سطح الطاولة.
- دوران الكرات متصل ب`omega` لكنه غير واضح بصرياً على معظم الكرات لأن المواد ألوان صلبة بلا علامات.
- شرط `speedXZ > 0` في مزامنة الدوران يجعل دوراناً فيزيائياً موجوداً بدون سرعة أفقية غير مرئي.
- `canShoot` في UI قد يتأخر حتى `0.12s`, فيظهر cue/aim guide أو يبقى زر الضرب مفعلاً لحظة قصيرة بعد بدء الحركة، رغم أن الفيزياء تمنع الضرب فعلياً.
- تمثيل الكرات المخططة قد يسبب artifacts لأنه child sphere مضغوط ومرفوع وليس stripe محيطياً.
- واجهة عربية تحتوي مصطلحات إنجليزية مختلطة مثل `Topspin`, `Backspin`, `Sidespin Right`, و`Scratch`.
- أثناء القفز، الفيزياء تتجاوز rails وpocket checks، لذلك قد يكون هناك مشهد غير بديهي إذا عبرت الكرة فوق حافة أو جيب وهي airborne.

## 17. هل يحتاج الرسم تحسين؟

### ضروري قبل التسليم

- إصلاح تمثيل الجيوب لتكون فتحات أفقية واضحة ومتوافقة بصرياً مع `POCKETS` و`POCKET_RADIUS`.
- جعل ظهور `CueStick` و`AimGuide` وزر الضرب يعتمد على حالة canShoot اللحظية أو تحديثها فور الضربة.
- إضافة علامات سطحية أو أرقام بسيطة للكرات حتى يكون دوران `omega` قابلاً للرؤية، خصوصاً cue والكرات الصلبة.

### تحسين اختياري

- تحسين تمثيل stripes ليكون شريطاً محيطياً لا cap/patch.
- توضيح labels العربية لمواضع الضربة والspin بدل المزج العربي والإنجليزي.
- عرض حالة airborne أو motionState في debug panel إن كان الهدف تعليمي.

### تحسين جمالي فقط

- ضبط ظلال الجيوب والحواف لتقليل أي تداخل بصري.
- إضافة زاوية كاميرا بديلة أو تحكم orbit بسيط لو كان المستخدم يحتاج فحص التصادمات من أكثر من زاوية.

## 18. نتائج الأوامر

تم تشغيل الأوامر التالية:

```text
npm.cmd run build
```

النتيجة: نجح البناء. Vite بنى المشروع وحول 30 module. ظهر تحذير فقط بأن chunk بعد التصغير أكبر من 500 kB. التحذير لا يؤثر على نتيجة تدقيق الربط الفيزيائي.

```text
npm.cmd run verify:physics
```

النتيجة:

```text
PASS rolling friction stop time
PASS rail rebound
PASS ball-ball normal impulse
PASS jump projectile motion
PASS sidespin path curvature
Physics checks: 5 passed, 0 failed
```

## 19. الحكم النهائي

- هل الرسم جاهز للتسليم؟ **جاهز وظيفياً، لكن ليس مثالياً بصرياً للتسليم الصارم**.
- هل كل شيء مرئي مربوط بالفيزياء؟ **لا بالكامل**. المواضع، التصويب، الجيوب رقمياً، القفز، والإحصائيات مربوطة جيداً. لكن تمثيل الجيوب، وضوح الدوران، وتأخر `canShoot` يجعل الحكم النهائي جزئياً.
- هل توجد مشاكل تمنع التسليم؟ **لا توجد مشكلة تشغيل أو انفصال كبير بين الرسم والفيزياء**. لكن لو معيار التسليم يطلب مطابقة بصرية كاملة، فمشاكل الجيوب والدوران تحتاج معالجة قبل التسليم.
- أهم 3 تحسينات مقترحة:
  1. إصلاح رسم الجيوب لتظهر كفتحات أفقية في سطح الطاولة.
  2. جعل دوران الكرات مرئياً بإضافة علامات/أرقام مرتبطة بدوران mesh.
  3. تحديث `canShoot` بصرياً فور تغير الحركة حتى تختفي العصا والدليل مباشرة بعد الضربة.
