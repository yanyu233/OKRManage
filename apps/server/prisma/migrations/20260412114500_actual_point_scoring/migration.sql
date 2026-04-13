UPDATE `KeyResult`
SET `reviewScore` = ROUND(`points` * `reviewScore` / 100, 2)
WHERE `reviewScore` IS NOT NULL
  AND `reviewScore` > `points`;
