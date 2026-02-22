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
-- Table structure for table `meter_brand`
--

DROP TABLE IF EXISTS `meter_brand`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meter_brand` (
  `MeterBrandId` int NOT NULL AUTO_INCREMENT,
  `MeterBrandName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ModelName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `IsActive` tinyint(1) NOT NULL,
  `CreatedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedOn` datetime(6) NOT NULL,
  `LastModifiedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `LastModifiedOn` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`MeterBrandId`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meter_brand`
--

LOCK TABLES `meter_brand` WRITE;
/*!40000 ALTER TABLE `meter_brand` DISABLE KEYS */;
INSERT INTO `meter_brand` VALUES (1,'Siemens','AB5478',NULL,1,'System','2021-10-19 00:29:00.852440',NULL,NULL),(2,'NOBRAND','-','Not Use',0,'Import','2021-11-17 01:27:00.000000','System','2021-11-17 02:00:10.060722'),(3,'ADTEK','AEM-DR2',NULL,1,'Import','2021-11-17 01:27:00.000000','System','2021-11-17 01:58:08.281460'),(4,'AEM-DR2','AEM-DR2',NULL,1,'Import','2021-11-17 12:22:55.038111','Import','2022-10-18 22:19:02.002120'),(5,'','',NULL,1,'Import','2021-11-17 12:22:55.036883','Import','2021-11-17 13:34:31.534166'),(6,'MPR-45S','MPR-45S',NULL,1,'Import','2021-11-17 15:52:53.925614','Import','2023-03-01 16:21:37.171654'),(7,'AEM-DR0','AEM-DR0',NULL,1,'Import','2021-12-09 07:48:32.650850','Import','2022-01-23 10:44:58.307002'),(8,'AEM-DR4','AEM-DR4',NULL,1,'Import','2021-12-09 07:48:32.650382','Import','2022-01-23 10:44:58.306600'),(9,'AEM-DR3','AEM-DR3',NULL,1,'Import','2021-12-09 07:48:32.649527','Import','2022-01-23 10:44:58.305550'),(10,'Manual',NULL,NULL,1,'Import','2022-09-21 15:36:52.023942','Import','2022-10-13 18:45:27.080806');
/*!40000 ALTER TABLE `meter_brand` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-08 12:48:31
