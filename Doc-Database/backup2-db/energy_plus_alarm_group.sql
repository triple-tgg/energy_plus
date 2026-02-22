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
-- Table structure for table `alarm_group`
--

DROP TABLE IF EXISTS `alarm_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alarm_group` (
  `AlarmGroupId` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `LineToken` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TelegramBotToken` varchar(100) DEFAULT NULL,
  `TelegramChatId` varchar(100) DEFAULT NULL,
  `TelegramApiUrl` varchar(100) DEFAULT NULL,
  `Interval` int NOT NULL,
  `IsActive` tinyint(1) NOT NULL,
  `CreatedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedOn` datetime(6) NOT NULL,
  `LastModifiedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `LastModifiedOn` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`AlarmGroupId`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alarm_group`
--

LOCK TABLES `alarm_group` WRITE;
/*!40000 ALTER TABLE `alarm_group` DISABLE KEYS */;
INSERT INTO `alarm_group` VALUES (3,'Monitoring CP2','Fb2G2hAaLjdNDk5ci2X4VSVn2mtKbMWTu0puOF3pTuZ','witchuda.kitviree@gmail.com','7785779530:AAFtO5O4_dtEq8F808iS7dd6MFDtqX9SLMQ','7076131807','https://api.telegram.org',15,0,'Anonymous','2022-01-28 23:31:20.214350',NULL,NULL),(4,'AppAdmin','YgcuLSutfulwV28MIHmNUaTiilGBCtLFLsY6aLwih9S','a@gmail.com',NULL,NULL,NULL,5,0,'Anonymous','2022-06-18 12:25:14.000000','Anonymous','2022-07-09 00:03:16.322544');
/*!40000 ALTER TABLE `alarm_group` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-08 13:04:56
