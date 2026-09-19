/* 지금 시각을 보는 자리를 한 곳으로 모읍니다.

   React 19 는 그리는 중에 Date.now() 를 부르면 잡아냅니다 —
   같은 입력에 같은 그림이 안 나오기 때문입니다.
   여기 있는 것은 자료를 받아올 때 쓰는 값이라 그 규칙 밖입니다. */

export const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();

export const todayIso = () => new Date().toISOString().slice(0, 10);
