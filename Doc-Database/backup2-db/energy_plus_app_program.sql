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
-- Table structure for table `app_program`
--

DROP TABLE IF EXISTS `app_program`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_program` (
  `ProgramId` int NOT NULL AUTO_INCREMENT,
  `ProgramName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ParentProgramId` int DEFAULT NULL,
  `ControllerName` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ActionName` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ProgramParam` varchar(45) DEFAULT NULL,
  `MenuIcon` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ProgramId`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_program`
--

LOCK TABLES `app_program` WRITE;
/*!40000 ALTER TABLE `app_program` DISABLE KEYS */;
INSERT INTO `app_program` VALUES (1,'ผู้ดูแลระบบ',NULL,NULL,NULL,NULL,'mdi mdi-shield-check menu-icon'),(2,'ข้อมูลบริษัท',1,'Companies','Index',NULL,NULL),(3,'ข้อมูลกลุ่มผู้ใช้งาน',1,'GroupUsers','Index',NULL,NULL),(4,'ข้อมูลผู้ใช้งาน',1,'AppUsers','Index',NULL,NULL),(5,'ข้อมูล Master',NULL,NULL,NULL,NULL,'mdi mdi-database menu-icon'),(9,'ประเภทอุปกรณ์',5,'MeterTypes','Index',NULL,NULL),(10,'Brand',5,'MeterBrands','Index',NULL,NULL),(11,'Loop',5,'Loops','Index',NULL,NULL),(12,'มิเตอร์',5,'Meters','Index',NULL,NULL),(13,'ตั้งค่าระบบ',NULL,NULL,NULL,NULL,'mdi mdi-wrench menu-icon'),(14,'ตั้งค่าภาพแผนผังสถานที่',13,'Layouts','Index',NULL,NULL),(15,'กลุ่มการแจ้งเตือน',13,'AlarmGroups','Index',NULL,NULL),(16,'ตั้งค่าการแจ้งเตือน',13,'AlarmConfigs','Index',NULL,NULL),(17,'Monitoring',NULL,NULL,NULL,NULL,'mdi mdi-airplay menu-icon'),(18,'ข้อมูลการใช้พลังงาน Realtime',17,'Monitoring','IndexRealtime',NULL,NULL),(19,'ภาพรวม',17,'Monitoring','IndexLayout',NULL,NULL),(20,'พยากรณ์ Demand Peak',17,'Monitoring','IndexForcastDemandPeak',NULL,NULL),(23,'รายงาน',NULL,NULL,NULL,NULL,'mdi mdi-file-document menu-icon'),(24,'การใช้พลังงานตามช่วงเวลา',23,'Report','IndexUsageByDay',NULL,NULL),(26,'ข้อมูลพลังงานย้อนหลัง',23,'Report','IndexHistorical',NULL,NULL),(27,'การใช้พลังงานเปรียบเทียบเดือนก่อน',23,'Report','IndexUsageCompareMonth',NULL,NULL),(28,'ข้อมูลการแจ้งเตือน',23,'AlarmLogs','Index',NULL,NULL),(29,'Dashboard',NULL,NULL,NULL,NULL,'mdi mdi-file-document menu-icon'),(30,'Zone Consumption',29,'Dashboard','IndexZoneConsumption',NULL,NULL),(31,'MDB Consumption',29,'Dashboard','IndexMDBConsumption',NULL,NULL),(35,'ตั้งค่า Billing',13,'BillingConfigs','Index',NULL,NULL),(36,'ตั้งค่าการ Export',13,'ExportConfigs','Index',NULL,NULL),(37,'ตั้งค่า Demand/Saving',13,'DemandPeakConfigs','Index',NULL,NULL),(38,'Demand',29,'Dashboard','IndexDemand',NULL,NULL),(39,'ข้อมูล Site',1,'Sites','Index',NULL,NULL),(40,'ข้อมูล อาคาร',1,'Buildings','Index',NULL,NULL),(41,'PW Consumption',29,'Dashboard','IndexPowerMeterConsumption',NULL,NULL);
/*!40000 ALTER TABLE `app_program` ENABLE KEYS */;
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
