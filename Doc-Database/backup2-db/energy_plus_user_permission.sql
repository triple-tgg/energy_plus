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
-- Table structure for table `user_permission`
--

DROP TABLE IF EXISTS `user_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permission` (
  `PermissionId` int NOT NULL AUTO_INCREMENT,
  `GroupId` int NOT NULL,
  `ProgramId` int NOT NULL,
  PRIMARY KEY (`PermissionId`),
  KEY `IX_User_Permission_GroupId` (`GroupId`),
  KEY `IX_User_Permission_ProgramId` (`ProgramId`),
  CONSTRAINT `FK_User_Permission_App_Program_ProgramId` FOREIGN KEY (`ProgramId`) REFERENCES `app_program` (`ProgramId`),
  CONSTRAINT `FK_User_Permission_Group_User_GroupId` FOREIGN KEY (`GroupId`) REFERENCES `group_user` (`GroupId`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permission`
--

LOCK TABLES `user_permission` WRITE;
/*!40000 ALTER TABLE `user_permission` DISABLE KEYS */;
INSERT INTO `user_permission` VALUES (1,3,1),(2,3,2),(3,3,3),(4,3,4),(5,3,39),(6,3,40),(7,3,5),(8,3,12),(9,3,13),(10,3,14),(11,3,35),(12,3,17),(13,3,18),(14,3,19),(15,3,23),(16,3,24),(17,3,26),(18,3,27),(19,3,28),(20,3,29),(21,3,30),(22,3,31),(23,3,38),(24,4,1),(25,4,2),(26,4,3),(27,4,4),(28,4,39),(29,4,40),(30,4,5),(31,4,9),(32,4,10),(33,4,11),(34,4,12),(35,4,13),(36,4,14),(37,4,15),(38,4,16),(39,4,35),(40,4,17),(41,4,18),(42,4,19),(43,4,23),(44,4,24),(45,4,26),(46,4,27),(47,4,28),(48,4,29),(49,4,30),(50,4,31),(51,4,38);
/*!40000 ALTER TABLE `user_permission` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-08 12:48:30
