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
-- Table structure for table `alarm_config`
--

DROP TABLE IF EXISTS `alarm_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alarm_config` (
  `AlarmConfigId` int NOT NULL AUTO_INCREMENT,
  `MeterId` int NOT NULL,
  `EnergyValueId` int NOT NULL,
  `LowerValue` double NOT NULL,
  `HigherValue` double NOT NULL,
  `LowerMessage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `HigherMessage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `IsActive` tinyint(1) NOT NULL,
  `CreatedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedOn` datetime(6) NOT NULL,
  `LastModifiedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `LastModifiedOn` datetime(6) DEFAULT NULL,
  `IsLampOn` tinyint(1) NOT NULL DEFAULT '0',
  `IsBuzzerOn` tinyint(1) NOT NULL DEFAULT '0',
  `LampAddress` int NOT NULL DEFAULT '0',
  `BuzzerAddress` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`AlarmConfigId`),
  KEY `IX_Alarm_Config_EnergyValueId` (`EnergyValueId`),
  KEY `IX_Alarm_Config_MeterId` (`MeterId`),
  CONSTRAINT `FK_Alarm_Config_Energy_Value_EnergyValueId` FOREIGN KEY (`EnergyValueId`) REFERENCES `energy_value` (`EnergyValueId`) ON DELETE RESTRICT,
  CONSTRAINT `FK_Alarm_Config_Meter_MeterId` FOREIGN KEY (`MeterId`) REFERENCES `meter` (`MeterId`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alarm_config`
--

LOCK TABLES `alarm_config` WRITE;
/*!40000 ALTER TABLE `alarm_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `alarm_config` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-08 13:05:08
