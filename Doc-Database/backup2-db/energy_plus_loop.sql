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
-- Table structure for table `loop`
--

DROP TABLE IF EXISTS `loop`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loop` (
  `LoopId` int NOT NULL,
  `PortNo` int NOT NULL,
  `Baudrate` int NOT NULL,
  `Stopbit` int NOT NULL,
  `Parity` int NOT NULL,
  `Databit` int NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `Remark` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`LoopId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loop`
--

LOCK TABLES `loop` WRITE;
/*!40000 ALTER TABLE `loop` DISABLE KEYS */;
INSERT INTO `loop` VALUES (0,0,4800,2,0,8,1,'Manual'),(1,2,9600,2,0,8,1,NULL),(2,3,9600,2,0,8,1,NULL),(3,4,9600,2,0,8,1,NULL),(4,5,9600,2,0,8,1,NULL),(5,6,9600,2,0,8,1,'Office 14-21'),(6,7,9600,2,0,8,1,'Office 22-27'),(7,8,9600,2,0,8,1,'Office 28-32'),(8,9,9600,2,0,8,1,'Office 28-32'),(9,10,9600,2,0,8,1,NULL),(10,11,9600,2,0,8,1,NULL),(11,12,9600,2,0,8,1,NULL),(12,13,9600,2,0,8,1,NULL),(13,14,9600,2,0,8,1,NULL),(14,15,9600,2,0,8,1,NULL),(15,16,9600,2,0,8,1,NULL);
/*!40000 ALTER TABLE `loop` ENABLE KEYS */;
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
