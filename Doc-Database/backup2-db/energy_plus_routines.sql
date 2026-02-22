-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: localhost    Database: energy_plus
-- ------------------------------------------------------
-- Server version	8.0.32

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Temporary view structure for view `alarm_low_high_config`
--

DROP TABLE IF EXISTS `alarm_low_high_config`;
/*!50001 DROP VIEW IF EXISTS `alarm_low_high_config`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `alarm_low_high_config` AS SELECT 
 1 AS `MeterId`,
 1 AS `LowKva`,
 1 AS `LowKw`,
 1 AS `LowKvar`,
 1 AS `LowFrequency`,
 1 AS `LowPWL1`,
 1 AS `LowPWL2`,
 1 AS `LowPWL3`,
 1 AS `LowKW1`,
 1 AS `LowKW2`,
 1 AS `LowKW3`,
 1 AS `LowKWh`,
 1 AS `LowKVAh`,
 1 AS `LowKVARh`,
 1 AS `LowVoltP1`,
 1 AS `LowVoltP2`,
 1 AS `LowVoltP3`,
 1 AS `LowVoltL1`,
 1 AS `LowVoltL2`,
 1 AS `LowVoltL3`,
 1 AS `LowAmp1`,
 1 AS `LowAmp2`,
 1 AS `LowAmp3`,
 1 AS `LowPf1`,
 1 AS `LowPf2`,
 1 AS `LowPf3`,
 1 AS `LowTHDV1`,
 1 AS `LowTHDV2`,
 1 AS `LowTHDV3`,
 1 AS `LowTHDA1`,
 1 AS `LowTHDA2`,
 1 AS `LowTHDA3`,
 1 AS `LowAmpAvr`,
 1 AS `LowAmpN`,
 1 AS `LowVLAvg`,
 1 AS `LowVPAvg`,
 1 AS `LowAmpAvg`,
 1 AS `LowKWAvg`,
 1 AS `HighKva`,
 1 AS `HighKw`,
 1 AS `HighKvar`,
 1 AS `HighFrequency`,
 1 AS `HighPWL1`,
 1 AS `HighPWL2`,
 1 AS `HighPWL3`,
 1 AS `HighKW1`,
 1 AS `HighKW2`,
 1 AS `HighKW3`,
 1 AS `HighKWh`,
 1 AS `HighKVAh`,
 1 AS `HighKVARh`,
 1 AS `HighVoltP1`,
 1 AS `HighVoltP2`,
 1 AS `HighVoltP3`,
 1 AS `HighVoltL1`,
 1 AS `HighVoltL2`,
 1 AS `HighVoltL3`,
 1 AS `HighAmp1`,
 1 AS `HighAmp2`,
 1 AS `HighAmp3`,
 1 AS `HighPf1`,
 1 AS `HighPf2`,
 1 AS `HighPf3`,
 1 AS `HighTHDV1`,
 1 AS `HighTHDV2`,
 1 AS `HighTHDV3`,
 1 AS `HighTHDA1`,
 1 AS `HighTHDA2`,
 1 AS `HighTHDA3`,
 1 AS `HighAmpAvr`,
 1 AS `HighAmpN`,
 1 AS `HighVLAvg`,
 1 AS `HighVPAvg`,
 1 AS `HighAmpAvg`,
 1 AS `HighKWAvg`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `alarm_low_high_config`
--

/*!50001 DROP VIEW IF EXISTS `alarm_low_high_config`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `alarm_low_high_config` AS with `cte1` as (select `cf`.`MeterId` AS `MeterId`,`ev`.`ParameterName` AS `ParameterName`,`cf`.`LowerValue` AS `LowerValue`,`cf`.`LowerMessage` AS `LowerMessage`,`cf`.`HigherValue` AS `HigherValue`,`cf`.`HigherMessage` AS `HigherMessage` from (`alarm_config` `cf` join `energy_value` `ev`) where (`cf`.`EnergyValueId` = `ev`.`EnergyValueId`)) select `cte1`.`MeterId` AS `MeterId`,sum(if((`cte1`.`ParameterName` = 'Kva'),`cte1`.`LowerValue`,NULL)) AS `LowKva`,sum(if((`cte1`.`ParameterName` = 'Kw'),`cte1`.`LowerValue`,NULL)) AS `LowKw`,sum(if((`cte1`.`ParameterName` = 'Kvar'),`cte1`.`LowerValue`,NULL)) AS `LowKvar`,sum(if((`cte1`.`ParameterName` = 'Frequency'),`cte1`.`LowerValue`,NULL)) AS `LowFrequency`,sum(if((`cte1`.`ParameterName` = 'PWL1'),`cte1`.`LowerValue`,NULL)) AS `LowPWL1`,sum(if((`cte1`.`ParameterName` = 'PWL2'),`cte1`.`LowerValue`,NULL)) AS `LowPWL2`,sum(if((`cte1`.`ParameterName` = 'PWL3'),`cte1`.`LowerValue`,NULL)) AS `LowPWL3`,sum(if((`cte1`.`ParameterName` = 'KW1'),`cte1`.`LowerValue`,NULL)) AS `LowKW1`,sum(if((`cte1`.`ParameterName` = 'KW2'),`cte1`.`LowerValue`,NULL)) AS `LowKW2`,sum(if((`cte1`.`ParameterName` = 'KW3'),`cte1`.`LowerValue`,NULL)) AS `LowKW3`,sum(if((`cte1`.`ParameterName` = 'KWh'),`cte1`.`LowerValue`,NULL)) AS `LowKWh`,sum(if((`cte1`.`ParameterName` = 'KVAh'),`cte1`.`LowerValue`,NULL)) AS `LowKVAh`,sum(if((`cte1`.`ParameterName` = 'KVARh'),`cte1`.`LowerValue`,NULL)) AS `LowKVARh`,sum(if((`cte1`.`ParameterName` = 'VoltP1'),`cte1`.`LowerValue`,NULL)) AS `LowVoltP1`,sum(if((`cte1`.`ParameterName` = 'VoltP2'),`cte1`.`LowerValue`,NULL)) AS `LowVoltP2`,sum(if((`cte1`.`ParameterName` = 'VoltP3'),`cte1`.`LowerValue`,NULL)) AS `LowVoltP3`,sum(if((`cte1`.`ParameterName` = 'VoltL1'),`cte1`.`LowerValue`,NULL)) AS `LowVoltL1`,sum(if((`cte1`.`ParameterName` = 'VoltL2'),`cte1`.`LowerValue`,NULL)) AS `LowVoltL2`,sum(if((`cte1`.`ParameterName` = 'VoltL3'),`cte1`.`LowerValue`,NULL)) AS `LowVoltL3`,sum(if((`cte1`.`ParameterName` = 'Amp1'),`cte1`.`LowerValue`,NULL)) AS `LowAmp1`,sum(if((`cte1`.`ParameterName` = 'Amp2'),`cte1`.`LowerValue`,NULL)) AS `LowAmp2`,sum(if((`cte1`.`ParameterName` = 'Amp3'),`cte1`.`LowerValue`,NULL)) AS `LowAmp3`,sum(if((`cte1`.`ParameterName` = 'Pf1'),`cte1`.`LowerValue`,NULL)) AS `LowPf1`,sum(if((`cte1`.`ParameterName` = 'Pf2'),`cte1`.`LowerValue`,NULL)) AS `LowPf2`,sum(if((`cte1`.`ParameterName` = 'Pf3'),`cte1`.`LowerValue`,NULL)) AS `LowPf3`,sum(if((`cte1`.`ParameterName` = 'THDV1'),`cte1`.`LowerValue`,NULL)) AS `LowTHDV1`,sum(if((`cte1`.`ParameterName` = 'THDV2'),`cte1`.`LowerValue`,NULL)) AS `LowTHDV2`,sum(if((`cte1`.`ParameterName` = 'THDV3'),`cte1`.`LowerValue`,NULL)) AS `LowTHDV3`,sum(if((`cte1`.`ParameterName` = 'THDA1'),`cte1`.`LowerValue`,NULL)) AS `LowTHDA1`,sum(if((`cte1`.`ParameterName` = 'THDA2'),`cte1`.`LowerValue`,NULL)) AS `LowTHDA2`,sum(if((`cte1`.`ParameterName` = 'THDA3'),`cte1`.`LowerValue`,NULL)) AS `LowTHDA3`,sum(if((`cte1`.`ParameterName` = 'AmpAvr'),`cte1`.`LowerValue`,NULL)) AS `LowAmpAvr`,sum(if((`cte1`.`ParameterName` = 'AmpN'),`cte1`.`LowerValue`,NULL)) AS `LowAmpN`,sum(if((`cte1`.`ParameterName` = 'VLAvg'),`cte1`.`LowerValue`,NULL)) AS `LowVLAvg`,sum(if((`cte1`.`ParameterName` = 'VPAvg'),`cte1`.`LowerValue`,NULL)) AS `LowVPAvg`,sum(if((`cte1`.`ParameterName` = 'AmpAvg'),`cte1`.`LowerValue`,NULL)) AS `LowAmpAvg`,sum(if((`cte1`.`ParameterName` = 'KWAvg'),`cte1`.`LowerValue`,NULL)) AS `LowKWAvg`,sum(if((`cte1`.`ParameterName` = 'Kva'),`cte1`.`HigherValue`,NULL)) AS `HighKva`,sum(if((`cte1`.`ParameterName` = 'Kw'),`cte1`.`HigherValue`,NULL)) AS `HighKw`,sum(if((`cte1`.`ParameterName` = 'Kvar'),`cte1`.`HigherValue`,NULL)) AS `HighKvar`,sum(if((`cte1`.`ParameterName` = 'Frequency'),`cte1`.`HigherValue`,NULL)) AS `HighFrequency`,sum(if((`cte1`.`ParameterName` = 'PWL1'),`cte1`.`HigherValue`,NULL)) AS `HighPWL1`,sum(if((`cte1`.`ParameterName` = 'PWL2'),`cte1`.`HigherValue`,NULL)) AS `HighPWL2`,sum(if((`cte1`.`ParameterName` = 'PWL3'),`cte1`.`HigherValue`,NULL)) AS `HighPWL3`,sum(if((`cte1`.`ParameterName` = 'KW1'),`cte1`.`HigherValue`,NULL)) AS `HighKW1`,sum(if((`cte1`.`ParameterName` = 'KW2'),`cte1`.`HigherValue`,NULL)) AS `HighKW2`,sum(if((`cte1`.`ParameterName` = 'KW3'),`cte1`.`HigherValue`,NULL)) AS `HighKW3`,sum(if((`cte1`.`ParameterName` = 'KWh'),`cte1`.`HigherValue`,NULL)) AS `HighKWh`,sum(if((`cte1`.`ParameterName` = 'KVAh'),`cte1`.`HigherValue`,NULL)) AS `HighKVAh`,sum(if((`cte1`.`ParameterName` = 'KVARh'),`cte1`.`HigherValue`,NULL)) AS `HighKVARh`,sum(if((`cte1`.`ParameterName` = 'VoltP1'),`cte1`.`HigherValue`,NULL)) AS `HighVoltP1`,sum(if((`cte1`.`ParameterName` = 'VoltP2'),`cte1`.`HigherValue`,NULL)) AS `HighVoltP2`,sum(if((`cte1`.`ParameterName` = 'VoltP3'),`cte1`.`HigherValue`,NULL)) AS `HighVoltP3`,sum(if((`cte1`.`ParameterName` = 'VoltL1'),`cte1`.`HigherValue`,NULL)) AS `HighVoltL1`,sum(if((`cte1`.`ParameterName` = 'VoltL2'),`cte1`.`HigherValue`,NULL)) AS `HighVoltL2`,sum(if((`cte1`.`ParameterName` = 'VoltL3'),`cte1`.`HigherValue`,NULL)) AS `HighVoltL3`,sum(if((`cte1`.`ParameterName` = 'Amp1'),`cte1`.`HigherValue`,NULL)) AS `HighAmp1`,sum(if((`cte1`.`ParameterName` = 'Amp2'),`cte1`.`HigherValue`,NULL)) AS `HighAmp2`,sum(if((`cte1`.`ParameterName` = 'Amp3'),`cte1`.`HigherValue`,NULL)) AS `HighAmp3`,sum(if((`cte1`.`ParameterName` = 'Pf1'),`cte1`.`HigherValue`,NULL)) AS `HighPf1`,sum(if((`cte1`.`ParameterName` = 'Pf2'),`cte1`.`HigherValue`,NULL)) AS `HighPf2`,sum(if((`cte1`.`ParameterName` = 'Pf3'),`cte1`.`HigherValue`,NULL)) AS `HighPf3`,sum(if((`cte1`.`ParameterName` = 'THDV1'),`cte1`.`HigherValue`,NULL)) AS `HighTHDV1`,sum(if((`cte1`.`ParameterName` = 'THDV2'),`cte1`.`HigherValue`,NULL)) AS `HighTHDV2`,sum(if((`cte1`.`ParameterName` = 'THDV3'),`cte1`.`HigherValue`,NULL)) AS `HighTHDV3`,sum(if((`cte1`.`ParameterName` = 'THDA1'),`cte1`.`HigherValue`,NULL)) AS `HighTHDA1`,sum(if((`cte1`.`ParameterName` = 'THDA2'),`cte1`.`HigherValue`,NULL)) AS `HighTHDA2`,sum(if((`cte1`.`ParameterName` = 'THDA3'),`cte1`.`HigherValue`,NULL)) AS `HighTHDA3`,sum(if((`cte1`.`ParameterName` = 'AmpAvr'),`cte1`.`HigherValue`,NULL)) AS `HighAmpAvr`,sum(if((`cte1`.`ParameterName` = 'AmpN'),`cte1`.`HigherValue`,NULL)) AS `HighAmpN`,sum(if((`cte1`.`ParameterName` = 'VLAvg'),`cte1`.`HigherValue`,NULL)) AS `HighVLAvg`,sum(if((`cte1`.`ParameterName` = 'VPAvg'),`cte1`.`HigherValue`,NULL)) AS `HighVPAvg`,sum(if((`cte1`.`ParameterName` = 'AmpAvg'),`cte1`.`HigherValue`,NULL)) AS `HighAmpAvg`,sum(if((`cte1`.`ParameterName` = 'KWAvg'),`cte1`.`HigherValue`,NULL)) AS `HighKWAvg` from `cte1` group by `cte1`.`MeterId` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-08 13:05:21
