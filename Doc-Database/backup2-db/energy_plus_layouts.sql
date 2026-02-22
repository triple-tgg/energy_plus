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
-- Table structure for table `layouts`
--

DROP TABLE IF EXISTS `layouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `layouts` (
  `LayoutId` int NOT NULL AUTO_INCREMENT,
  `LayoutName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ImageName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `LayoutType` int NOT NULL DEFAULT '0',
  `IsActive` tinyint(1) NOT NULL,
  `CreatedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedOn` datetime(6) NOT NULL,
  `LastModifiedBy` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `LastModifiedOn` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`LayoutId`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `layouts`
--

LOCK TABLES `layouts` WRITE;
/*!40000 ALTER TABLE `layouts` DISABLE KEYS */;
INSERT INTO `layouts` VALUES (3,'ชั้น 1 พลาซ่า (โซน A)','1a-01222957395.png',0,1,'Anonymous','2021-11-14 21:23:49.000000','Anonymous','2022-08-16 01:29:57.396623'),(4,'ชั้น 1 พลาซ่า (โซน B)','1b-01225223675.png',0,1,'Anonymous','2021-11-14 23:24:13.000000','Anonymous','2022-08-23 21:52:23.676877'),(5,'ชั้น 2 พลาซ่า (โซน A)','2a-01225242089.png',0,1,'Anonymous','2021-11-15 09:23:54.000000','Anonymous','2022-08-23 21:52:42.090954'),(6,'ชั้น 2 พลาซ่า (โซน B)','2b-01225250834.png',0,1,'Anonymous','2021-11-15 09:24:21.000000','Anonymous','2022-08-23 21:52:50.836171'),(7,'ชั้น 2 ไอทีมอล์ , โลตัส (โซน C)','2c-01225259975.png',0,1,'Anonymous','2021-11-15 09:24:42.000000','Anonymous','2022-08-23 21:52:59.976856'),(8,'ชั้น 3 พลาซ่า (โซน A)','3a-01225312138.png',0,1,'Anonymous','2021-11-15 09:24:57.000000','Anonymous','2022-08-23 21:53:12.140450'),(9,'ชั้น 3 พลาซ่า (โซน B)','3b-01225322478.png',0,1,'Anonymous','2021-11-15 09:25:12.000000','Anonymous','2022-08-23 21:53:22.480435'),(10,'ชั้น 3 ไอทีมอล์ (โซน A)','3c-01225331409.png',0,1,'Anonymous','2021-11-15 09:25:29.000000','Anonymous','2022-08-23 21:53:31.411182'),(11,'ชั้น 4 พลาซ่า (โซน A)','4a-01225500148.png',0,1,'Anonymous','2021-11-15 09:25:56.000000','Anonymous','2022-08-23 21:55:00.151603'),(12,'ชั้น 4 พลาซ่า (โซน B)','4b-01225516233.png',0,1,'Anonymous','2021-11-15 09:26:11.000000','Anonymous','2022-08-23 21:55:16.234709'),(13,'ชั้น 4 ไอทีมอล์ (โซน C)','4c-01225528957.png',0,1,'Anonymous','2021-11-15 09:26:29.000000','Anonymous','2022-08-23 21:55:28.958644'),(14,'ชั้น G พลาซ่า (โซน A)','Ga-01225546693.png',0,1,'Anonymous','2021-11-15 09:26:52.000000','Anonymous','2022-08-23 21:55:46.694813'),(15,'ชั้น G พลาซ่า (โซน B)','Gb-01225600902.png',0,1,'Anonymous','2021-11-15 09:27:08.000000','Anonymous','2022-08-23 21:56:00.903377'),(16,'ชั้น G ไอทีมอล์ (โซน C)','Gc-01225617849.png',0,1,'Anonymous','2021-11-15 09:27:22.000000','Anonymous','2022-08-23 21:56:17.851693'),(17,'สำนักงาน ชั้น 11','11225853876.png',0,1,'Anonymous','2021-11-17 15:09:30.000000','Anonymous','2022-08-23 21:58:53.877380'),(18,'สำนักงาน ชั้น 12','12225910986.png',0,1,'Anonymous','2021-11-17 15:10:07.000000','Anonymous','2022-08-23 21:59:10.986984'),(19,'สำนักงาน ชั้น 14','14225926714.png',0,1,'Anonymous','2021-11-17 15:10:25.000000','Anonymous','2022-08-23 21:59:26.715897'),(20,'สำนักงาน ชั้น 16','16225951783.png',0,1,'Anonymous','2021-11-17 15:10:46.000000','Anonymous','2022-08-23 21:59:51.784497'),(21,'สำนักงาน ชั้น 17','17220004391.png',0,1,'Anonymous','2021-11-17 15:11:05.000000','Anonymous','2022-08-23 22:00:04.392504'),(22,'สำนักงาน ชั้น 18','18220018343.png',0,1,'Anonymous','2021-11-17 15:11:22.000000','Anonymous','2022-08-23 22:00:18.343820'),(23,'สำนักงาน ชั้น 19','19220034555.png',0,1,'Anonymous','2021-11-17 15:11:42.000000','Anonymous','2022-08-23 22:00:34.555963'),(24,'สำนักงาน ชั้น 20','20220053302.png',0,1,'Anonymous','2021-11-17 15:12:17.000000','Anonymous','2022-08-23 22:00:53.303965'),(25,'สำนักงาน ชั้น 21','21220104626.png',0,1,'Anonymous','2021-11-17 15:12:33.000000','Anonymous','2022-08-23 22:01:04.626885'),(26,'สำนักงาน ชั้น 22','22220117213.png',0,1,'Anonymous','2021-11-17 15:12:51.000000','Anonymous','2022-08-23 22:01:17.214586'),(27,'สำนักงาน ชั้น 23','23220129771.png',0,1,'Anonymous','2021-11-17 15:13:21.000000','Anonymous','2022-08-23 22:01:29.771887'),(28,'สำนักงาน ชั้น 24','24220204772.png',0,1,'Anonymous','2021-11-17 15:13:54.000000','Anonymous','2022-08-23 22:02:04.773714'),(29,'สำนักงาน ชั้น 25','25220216489.png',0,1,'Anonymous','2021-11-17 15:14:14.000000','Anonymous','2022-08-23 22:02:16.490297'),(30,'สำนักงาน ชั้น 26','26220230950.png',0,1,'Anonymous','2021-11-17 15:14:31.000000','Anonymous','2022-08-23 22:02:30.952190'),(31,'สำนักงาน ชั้น 27','27220241293.png',0,1,'Anonymous','2021-11-17 15:14:51.000000','Anonymous','2022-08-23 22:02:41.293673'),(32,'สำนักงาน ชั้น 28','28220258027.png',0,1,'Anonymous','2021-11-17 15:15:13.000000','Anonymous','2022-08-23 22:02:58.027812'),(33,'สำนักงาน ชั้น 30','30220320594.png',0,1,'Anonymous','2021-11-17 15:15:41.000000','Anonymous','2022-08-23 22:03:20.595230'),(34,'สำนักงาน ชั้น 31','31220334177.png',0,1,'Anonymous','2021-11-17 15:15:57.000000','Anonymous','2022-08-23 22:03:34.178628'),(35,'สำนักงาน ชั้น 15','15225940025.png',0,1,'Anonymous','2021-11-17 17:29:43.000000','Anonymous','2022-08-23 21:59:40.025977'),(36,'MDB','MDB222805960.png',1,1,'Anonymous','2021-11-20 19:43:06.000000','Anonymous','2023-04-07 00:25:24.379808'),(37,'สำนักงาน ชั้น 29','29220309567.png',0,1,'Anonymous','2021-11-25 23:25:55.000000','Anonymous','2022-08-23 22:03:09.567658'),(38,'ชั้น 1 ไอทีมอล์ , โลตัส (โซน C)','1c-01225234535.png',0,1,'Anonymous','2021-11-30 00:19:30.000000','Anonymous','2022-08-23 21:52:34.537461'),(39,'ชั้น 3 ไอทีมอล์ (โซน B)','3b-01225430139.png',0,1,'Anonymous','2021-12-13 20:43:48.000000','Anonymous','2022-08-23 21:54:30.140859'),(43,'ลานจอดรถชั้น 5 (3)','5-3225723695.png',0,1,'Anonymous','2021-12-18 14:13:39.000000','Anonymous','2022-08-23 21:57:23.696055'),(44,'ลานจอดรถชั้น 6','6-2225749086.png',0,1,'Anonymous','2021-12-18 14:14:12.000000','Anonymous','2022-08-23 21:57:49.087299'),(45,'ลานจอดรถชั้น 7','7-1225803159.png',0,1,'Anonymous','2021-12-18 14:14:36.000000','Anonymous','2022-08-23 21:58:03.160166'),(46,'ลานจอดรถชั้น 8','8-3225817156.png',0,1,'Anonymous','2021-12-18 14:14:56.000000','Anonymous','2022-08-23 21:58:17.157033'),(47,'ลานจอดรถชั้น 9 (1)','9-1225827876.png',0,1,'Anonymous','2021-12-18 14:15:37.000000','Anonymous','2022-08-23 21:58:27.877797'),(48,'ลานจอดรถชั้น 9 (3)','9-3225838302.png',0,1,'Anonymous','2021-12-18 14:16:00.000000','Anonymous','2022-08-23 21:58:38.302747'),(49,'ลานจอดรถชั้น 10','10225649718.png',0,1,'Anonymous','2021-12-18 14:16:41.000000','Anonymous','2022-08-23 21:56:49.718987'),(50,'ลานจอดรถชั้น 4.5','ชั้น4225706502.png',0,1,'Anonymous','2021-12-18 14:56:01.000000','Anonymous','2022-08-23 21:57:06.505448');
/*!40000 ALTER TABLE `layouts` ENABLE KEYS */;
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
