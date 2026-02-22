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
-- Table structure for table `energy_value`
--

DROP TABLE IF EXISTS `energy_value`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `energy_value` (
  `EnergyValueId` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DisplayDefault` tinyint(1) NOT NULL,
  `SeqNo` int NOT NULL,
  `ParameterName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `MeterTypeId` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`EnergyValueId`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `energy_value`
--

LOCK TABLES `energy_value` WRITE;
/*!40000 ALTER TABLE `energy_value` DISABLE KEYS */;
INSERT INTO `energy_value` VALUES (1,'Kva','',0,1,'Kva',1),(2,'Kw','',0,2,'Kw',1),(3,'Kvar','',0,3,'Kvar',1),(4,'Frequency','',0,4,'Frequency',1),(5,'PWL1','',0,5,'PWL1',1),(6,'PWL2','',0,6,'PWL2',1),(7,'PWL3','',0,7,'PWL3',1),(8,'Kw 1','Kw',0,8,'KW1',1),(9,'Kw 2','Kw',0,9,'KW2',1),(10,'Kw 3','Kw',0,10,'KW3',1),(11,'KWh','Unit',1,11,'KWh',1),(12,'KVAh','',0,12,'KVAh',1),(13,'KVARh','',0,13,'KVARh',1),(14,'Volt P1','V',0,14,'VoltP1',1),(15,'Volt P2','V',0,15,'VoltP2',1),(16,'Volt P3','V',0,16,'VoltP3',1),(17,'Volt L1','V',0,17,'VoltL1',1),(18,'Volt L2','V',0,18,'VoltL2',1),(19,'Volt L3','V',0,19,'VoltL3',1),(20,'Amp 1','A',0,20,'Amp1',1),(21,'Amp 2','A',0,21,'Amp2',1),(22,'Amp 3','A',0,22,'Amp3',1),(23,'Power Factor 1','',0,23,'Pf1',1),(24,'Power Factor 2','',0,24,'Pf2',1),(25,'Power Factor 3','',0,25,'Pf3',1),(26,'THD V1','%',0,26,'THDV1',1),(27,'THD V2','%',0,27,'THDV2',1),(28,'THD V3','%',0,28,'THDV3',1),(29,'THD A1','%',0,29,'THDA1',1),(30,'THD A2','%',0,30,'THDA2',1),(31,'THD A3','%',0,31,'THDA3',1),(32,'AmpAvr','A',0,32,'AmpAvr',1),(33,'AmpN','A',0,33,'AmpN',1),(34,'VLavg','V',0,34,'VLAvg',1),(35,'VPavg','V',0,35,'VPAvg',1),(36,'AmpAvg','V',0,36,'AmpAvg',1),(37,'KWAvg','V',0,37,'KWAvg',1),(38,'WaterValue','',0,38,'WaterValue',1),(39,'GasValue','',0,39,'GasValue',1);
/*!40000 ALTER TABLE `energy_value` ENABLE KEYS */;
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
